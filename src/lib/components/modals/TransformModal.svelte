<svelte:options immutable={true} />

<script lang="ts">
  import { uniqueId } from '../../utils/uniqueId.js'
  import { faCaretDown, faCaretRight } from '@fortawesome/free-solid-svg-icons'
  import { debounce, isEmpty, noop } from 'lodash-es'
  import { getContext } from 'svelte'
  import Icon from 'svelte-awesome'
  import { DEBOUNCE_DELAY } from '../../constants.js'
  import type { JSONPath, JSONValue } from 'immutable-json-patch'
  import { compileJSONPointer, getIn } from 'immutable-json-patch'
  import { stringifyJSONPath } from '../../utils/pathUtils.js'
  import { transformModalState } from './transformModalState.js'
  import TransformWizard from './TransformWizard.svelte'
  import TransformModalHeader from './TransformModalHeader.svelte'
  import AbsolutePopup from './popup/AbsolutePopup.svelte'
  import { createDebug } from '../../utils/debug'
  import TreeMode from '../modes/treemode/TreeMode.svelte'

  import type monaco from 'monaco-editor';
  import { onMount } from 'svelte';
  import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
  import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
  import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
  import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
  import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

  import type {
    Content,
    JSONParser,
    OnChangeQueryLanguage,
    OnClassName,
    OnPatch,
    OnRenderValue,
    QueryLanguage
  } from '../../types'
  import { stripRootObject } from '$lib/utils/pathUtils'


  let divEl: HTMLDivElement = null;
  let editor: monaco.editor.IStandaloneCodeEditor;
  let Monaco;

  onMount(async () => {
      // @ts-ignore
      self.MonacoEnvironment = {
          getWorker: function (_moduleId: any, label: string) {
              if (label === 'json') {
                  return new jsonWorker();
              }
              if (label === 'css' || label === 'scss' || label === 'less') {
                  return new cssWorker();
              }
              if (label === 'html' || label === 'handlebars' || label === 'razor') {
                  return new htmlWorker();
              }
              if (label === 'typescript' || label === 'javascript') {
                  return new tsWorker();
              }
              return new editorWorker();
          }
      };

      Monaco = await import('monaco-editor');
      editor = Monaco.editor.create(divEl, {
          value: query,
          language: queryLanguageId == 'jmespath' ? 'plaintext' : 'javascript'
      });

      return () => {
          editor.dispose();
      };
  });


  const debug = createDebug('jsoneditor:TransformModal')

  export let id = 'transform-modal-' + uniqueId()
  export let json: JSONValue
  export let selectedPath: JSONPath = []

  export let escapeControlCharacters: boolean
  export let escapeUnicodeCharacters: boolean
  export let parser: JSONParser

  export let queryLanguages: QueryLanguage[]
  export let queryLanguageId: string
  export let onChangeQueryLanguage: OnChangeQueryLanguage

  export let onRenderValue: OnRenderValue
  export let onClassName: OnClassName

  export let onTransform: OnPatch

  $: selectedJson = getIn(json, selectedPath)
  $: selectedContent = { json: selectedJson }

  const { close } = getContext('simple-modal')

  const stateId = `${id}:${compileJSONPointer(selectedPath)}`

  const state = transformModalState[stateId] || {}

  // showWizard is not stored inside a stateId
  let showWizard = transformModalState.showWizard !== false
  let showOriginal = transformModalState.showOriginal !== false

  let queryOptions = state.queryOptions || {}
  let query =
    queryLanguageId === state.queryLanguageId && state.query
      ? state.query
      : getSelectedQueryLanguage(queryLanguageId).createQuery(json, state.queryOptions || {})
  let isManual = state.isManual || false

  let previewError = undefined
  let previewContent: Content = { text: '' }

  function getSelectedQueryLanguage(queryLanguageId: string): QueryLanguage {
    return queryLanguages.find((item) => item.id === queryLanguageId) || queryLanguages[0]
  }
  console.log('shijin debug queryLanguageId', queryLanguageId)

  function updateQueryByWizard(newQueryOptions) {
    queryOptions = newQueryOptions
    query = getSelectedQueryLanguage(queryLanguageId).createQuery(json, newQueryOptions)
    isManual = false

    debug('updateQueryByWizard', { queryOptions, query, isManual })
  }

  function handleChangeQuery(event) {
    query = event.target.value
    isManual = true
    debug('handleChangeQuery', { query, isManual })
  }

  function previewTransform(json: JSONValue, query: string) {
    try {
      debug('previewTransform', {
        query
      })
      const jsonTransformed = getSelectedQueryLanguage(queryLanguageId).executeQuery(json, query)

      previewContent = { json: jsonTransformed }
      previewError = undefined
    } catch (err) {
      previewContent = { text: '' }
      previewError = err
    }
  }

  const previewTransformDebounced = debounce(previewTransform, DEBOUNCE_DELAY)

  $: {
    previewTransformDebounced(selectedJson, query)
  }

  $: {
    // remember the selected values for the next time we open the SortModal
    // just in memory, not persisted
    transformModalState[stateId] = {
      queryOptions,
      query,
      queryLanguageId,
      isManual
    }

    debug('store state in memory', stateId, transformModalState[stateId])
  }

  function handleTransform() {
    try {
      debug('handleTransform', { query })
      const jsonTransformed = getSelectedQueryLanguage(queryLanguageId).executeQuery(
        selectedJson,
        query
      )

      onTransform([
        {
          op: 'replace',
          path: compileJSONPointer(selectedPath),
          value: jsonTransformed
        }
      ])

      close()
    } catch (err) {
      // this should never occur since we can only press the Transform
      // button when creating a preview was successful
      console.error(err)
      previewContent = { text: '' }
      previewError = err.toString()
    }
  }

  function toggleShowWizard() {
    showWizard = !showWizard

    // not stored inside a stateId
    transformModalState.showWizard = showWizard
  }

  function toggleShowOriginal() {
    showOriginal = !showOriginal

    // not stored inside a stateId
    transformModalState.showOriginal = showOriginal
  }

  function focus(element: HTMLElement) {
    element.focus()
  }

  function handleChangeQueryLanguage(newQueryLanguageId: string) {
    debug('handleChangeQueryLanguage', newQueryLanguageId)
    queryLanguageId = newQueryLanguageId
    onChangeQueryLanguage(newQueryLanguageId)

    const newSelectedQueryLanguage = getSelectedQueryLanguage(queryLanguageId)
    query = newSelectedQueryLanguage.createQuery(json, queryOptions)
    isManual = false
  }
</script>

<div class="jse-modal jse-transform">
  <AbsolutePopup>
    <TransformModalHeader
      {queryLanguages}
      {queryLanguageId}
      onChangeQueryLanguage={handleChangeQueryLanguage}
    />
    <div class="jse-contents">
      <div class="jse-main-contents">
        <div class="jse-query-contents">
          <div class="jse-label">
            <div class="jse-label-inner">Language</div>
          </div>
          <div class="jse-description">
            {@html getSelectedQueryLanguage(queryLanguageId).description}
          </div>

          <div class="jse-label">
            <div class="jse-label-inner">Path</div>
          </div>
          <input
            class="jse-path"
            type="text"
            readonly
            title="Selected path"
            value={!isEmpty(selectedPath)
              ? stripRootObject(stringifyJSONPath(selectedPath))
              : '(whole document)'}
          />

          <div class="jse-label">
            <div class="jse-label-inner">
              <button type="button" on:click={toggleShowWizard}>
                <Icon data={showWizard ? faCaretDown : faCaretRight} />
                Wizard
              </button>
            </div>
          </div>
          {#if showWizard}
            {#if Array.isArray(selectedJson)}
              <TransformWizard {queryOptions} json={selectedJson} onChange={updateQueryByWizard} />
            {:else}
              (Only available for arrays, not for objects._shijin updated)
            {/if}
          {/if}

          <div class="jse-label">
            <div class="jse-label-inner">Query</div>
          </div>
          <div bind:this={divEl} class="jse-query" spellcheck="false" value={query} on:input={handleChangeQuery}/>
          <!-- <textarea
            class="jse-query"
            spellcheck="false"
            value={query}
            on:input={handleChangeQuery}
          /> -->
        </div>
        <div class="jse-data-contents" class:jse-hide-original-data={!showOriginal}>
          <div class="jse-original-data" class:jse-hide={!showOriginal}>
            <div class="jse-label">
              <div class="jse-label-inner">
                <button type="button" on:click={toggleShowOriginal}>
                  <Icon data={showOriginal ? faCaretDown : faCaretRight} />
                  Original
                </button>
              </div>
            </div>
            {#if showOriginal}
              <TreeMode
                externalContent={selectedContent}
                readOnly={true}
                mainMenuBar={false}
                navigationBar={false}
                {escapeControlCharacters}
                {escapeUnicodeCharacters}
                {parser}
                {onRenderValue}
                onError={console.error}
                onChange={noop}
                onFocus={noop}
                onBlur={noop}
                onSortModal={noop}
                onTransformModal={noop}
                {onClassName}
              />
            {/if}
          </div>
          <div class="jse-preview-data">
            <div class="jse-label">
              <div class="jse-label-inner">Preview</div>
            </div>
            {#if !previewError}
              <TreeMode
                externalContent={previewContent}
                readOnly={true}
                mainMenuBar={false}
                navigationBar={false}
                {escapeControlCharacters}
                {escapeUnicodeCharacters}
                {parser}
                {onRenderValue}
                onError={console.error}
                onChange={noop}
                onFocus={noop}
                onBlur={noop}
                onSortModal={noop}
                onTransformModal={noop}
                {onClassName}
              />
            {:else}
              <div class="jse-preview jse-error">
                {previewError.toString()}
              </div>
            {/if}
          </div>
        </div>
      </div>

      <div class="jse-actions">
        <button
          type="button"
          class="jse-primary"
          on:click={handleTransform}
          use:focus
          disabled={!!previewError}
        >
          Transform
        </button>
      </div>
    </div>
  </AbsolutePopup>
</div>

<style src="./TransformModal.scss"></style>
