<script lang="ts">
  import {
    createAjvValidator,
    EditableValue,
    javascriptQueryLanguage,
    jmespathQueryLanguage,
    JSONEditor,
    lodashQueryLanguage,
    ReadonlyValue,
    renderValue
  } from '$lib'
  import { useLocalStorage } from '../../lib/utils/localStorageUtils.js'
  import { range } from 'lodash-es'
  import { tick } from 'svelte'
  import { parse, stringify } from 'lossless-json'
  import { truncate } from '$lib/utils/stringUtils.js'
  import { parseJSONPath, stringifyJSONPath } from '$lib/utils/pathUtils'
  import { compileJSONPointer, parseJSONPointer } from 'immutable-json-patch'
  import { Mode } from '$lib/types'

  // const LosslessJSON: JSONParser = { ... } // FIXME: make the types work
  const LosslessJSON = {
    parse,
    stringify
  }

  let content = {
    text: ``,
    json: undefined
  }

  const themes = [
    { value: 'jse-theme-default', label: 'default' },
    { value: 'jse-theme-dark', label: 'dark' },
    { value: 'jse-theme-big', label: 'big' }
  ]

  const indentations = [
    { value: 2, label: '2 spaces' },
    { value: 3, label: '3 spaces' },
    { value: '    ', label: '4 spaces' }, // equivalent to value: 4
    { value: 6, label: '6 spaces' },
    { value: 8, label: '8 spaces' },
    { value: '\t', label: '1 tab' }
  ]

  const parsers = [
    {
      id: 'JSON',
      value: JSON,
      label: 'JSON'
    },
    {
      id: 'LosslessJSON',
      value: LosslessJSON,
      label: 'LosslessJSON'
    }
  ]

  const pathParsers = [
    {
      id: 'JSONPath',
      value: {
        parse: parseJSONPath,
        stringify: stringifyJSONPath
      },
      label: 'JSONPath'
    },
    {
      id: 'JSONPointer',
      value: {
        parse: parseJSONPointer,
        stringify: compileJSONPointer
      },
      label: 'JSONPointer'
    }
  ]

  let refTreeEditor
  let refTextEditor

  // for debugging
  $: if (typeof window !== 'undefined') {
    window['refTreeEditor'] = refTreeEditor
  }
  $: if (typeof window !== 'undefined') {
    window['refTextEditor'] = refTextEditor
  }

  let height = '100%'
  const readOnly = useLocalStorage('svelte-jsoneditor-demo-readOnly', false)
  const mainMenuBar = useLocalStorage('svelte-jsoneditor-demo-mainMenuBar', true)
  const navigationBar = useLocalStorage('svelte-jsoneditor-demo-navigationBar', false)
  const statusBar = useLocalStorage('svelte-jsoneditor-demo-statusBar', true)
  const escapeControlCharacters = useLocalStorage( 'svelte-jsoneditor-demo-escapeControlCharacters', false )
  const escapeUnicodeCharacters = useLocalStorage( 'svelte-jsoneditor-demo-escapeUnicodeCharacters', false )
  const useCustomValueRenderer = useLocalStorage( 'svelte-jsoneditor-demo-useCustomValueRenderer', false )
  const multipleQueryLanguages = useLocalStorage( 'svelte-jsoneditor-demo-multipleQueryLanguages', true )
  const selectedTheme = useLocalStorage('svelte-jsoneditor-demo-theme', themes[0].value)
  const selectedIndentation = useLocalStorage( 'svelte-jsoneditor-demo-indentation', indentations[0].value )
  const selectedParserId = useLocalStorage('svelte-jsoneditor-demo-parser', parsers[0].id)
  const selectedPathParserId = useLocalStorage( 'svelte-jsoneditor-demo-path-parser', pathParsers[0].id )
  const tabSize = useLocalStorage('svelte-jsoneditor-demo-tabSize', indentations[0].value)
  
  $: queryLanguages = $multipleQueryLanguages
    ? [javascriptQueryLanguage, lodashQueryLanguage, jmespathQueryLanguage]
    : [javascriptQueryLanguage]
  let queryLanguageId = javascriptQueryLanguage.id // TODO: store in local storage

  $: selectedParser = parsers.find((parser) => parser.id === $selectedParserId).value
  $: selectedPathParser = pathParsers.find((parser) => parser.id === $selectedPathParserId).value

  // only editable/readonly div, no color picker, boolean toggle, timestamp
  function customRenderValue({
    path,
    value,
    readOnly,
    enforceString,
    searchResultItems,
    isEditing,
    normalization,
    onPatch,
    onPasteJson,
    onSelect,
    onFind,
    focus
  }) {
    const renderers = []

    if (isEditing) {
      renderers.push({
        component: EditableValue,
        props: {
          path,
          value,
          enforceString,
          normalization,
          onPatch,
          onPasteJson,
          onSelect,
          onFind,
          focus
        }
      })
    }

    if (!isEditing) {
      renderers.push({
        component: ReadonlyValue,
        props: { path, value, readOnly, normalization, searchResultItems, onSelect }
      })
    }

    return renderers
  }

  function onRenderMenu(mode, items) {
    if (!import.meta.env.SSR) {
      console.log('onRenderMenu', mode, items)
    }
  }

  let leftEditorMode = Mode.text
</script>

<svelte:head>
  <title>shijin json</title>
</svelte:head>

<div class="demo-app {$selectedTheme}">
  <div class="columns">
    <div class="left">
      <div class="editor" style="height: {height}">
        <JSONEditor
            bind:this={refTreeEditor}
            bind:content
            bind:mode={leftEditorMode}
            mainMenuBar={$mainMenuBar}
            navigationBar={$navigationBar}
            statusBar={$statusBar}
            escapeControlCharacters={$escapeControlCharacters}
            escapeUnicodeCharacters={$escapeUnicodeCharacters}
            readOnly={$readOnly}
            indentation={$selectedIndentation}
            tabSize={$tabSize}
            parser={selectedParser}
            pathParser={selectedPathParser}
            {queryLanguages}
            bind:queryLanguageId
            {onRenderMenu}
            onRenderValue={$useCustomValueRenderer ? customRenderValue : renderValue}
          />
      </div>
    </div>
    <div class="right">
      <p>
        <label>
          Indentation: <select bind:value={$selectedIndentation}>
            {#each indentations as indentation}
              <option value={indentation.value}>{indentation.label}</option>
            {/each}
          </select>
        </label>
        <label>
          tabSize: <input type="number" bind:value={$tabSize} />
        </label>
        <label>
          Height: <input type="text" bind:value={height} />
        </label>
        <label>
          Theme: <select bind:value={$selectedTheme}>
            {#each themes as theme}
              <option value={theme.value}>{theme.label}</option>
            {/each}
          </select>
        </label>
      </p>
      <p>
        <label>
          <input type="checkbox" bind:checked={$mainMenuBar} /> mainMenuBar
        </label>
        <br/>
        <label>
          <input type="checkbox" bind:checked={$navigationBar} /> navigationBar
        </label>
        <br/>
        <label>
          <input type="checkbox" bind:checked={$statusBar} /> statusBar
        </label>
        <br/>
        <label>
          <input type="checkbox" bind:checked={$escapeControlCharacters} /> escapeControlCharacters
        </label>
        <br/>
        <label>
          <input type="checkbox" bind:checked={$escapeUnicodeCharacters} /> escapeUnicodeCharacters
        </label>
        <br/>
        <label>
          <input type="checkbox" bind:checked={$readOnly} /> readOnly
        </label>
        <br/>
        <label>
          <input type="checkbox" bind:checked={$useCustomValueRenderer} /> Custom onRenderValue
        </label>
      </p>
      <p>
        <label>
          <input type="checkbox" bind:checked={$multipleQueryLanguages} /> Multiple query languages
        </label>
        {#if $multipleQueryLanguages}
          . Selected query language:
          <select bind:value={queryLanguageId}>
            {#each queryLanguages as queryLanguage}
              <option value={queryLanguage.id}>{queryLanguage.name}</option>
            {/each}
          </select>
        {/if}
      </p>
    
      <p>
        JSON Parser: <select bind:value={$selectedParserId}>
          {#each parsers as parser}
            <option value={parser.id}>{parser.label}</option>
          {/each}
        </select>
        <br/>
        Path Parser:
        <select bind:value={$selectedPathParserId}>
          {#each pathParsers as pathParser}
            <option value={pathParser.id}>{pathParser.label}</option>
          {/each}
        </select>
      </p>
    </div>
  </div>
</div>

<!--
Workaround for the console warning:

 <Development> received an unexpected slot "default".

See https://github.com/sveltejs/kit/issues/981
-->
{#if false}
  <slot />
{/if}

<style lang="scss">
  @import '../../lib/themes/jse-theme-dark.css';
  @import '../themes/jse-theme-big.css';

  .demo-app {
    margin: -10px; // compensate for the padding of the root element
    padding: 10px;
    height: 100%;
    overflow: auto;

    &.jse-theme-dark {
      background: #4d4d4d;
      color: #fff;
    }

    &.jse-theme-big {
      background: #ffe2d8;
    }
  }

  .columns {
    display: flex;
    gap: 20px;
    width: 100%;
  }

  .columns .left {
    flex: 6;
  }

  .columns .right {
    flex: 1;
    min-width: 0;
  }

  .tree-editor,
  .text-editor {
    // some styling to try out if it doesn't break the styling of the editor
    line-height: 72px;
    font-size: 72px;
    font-family: 'Comic Sans MS', 'Courier New', serif;
  }

  .mode-toggle {
    font-size: 12pt;
    font-family: arial, serif;
  }

  .data {
    margin-top: 10px;
  }

  pre {
    background: #f5f5f5;
  }

  p {
    max-width: none;
    margin: 10px 0;

    &.buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }
  }

  button,
  input,
  select {
    font-size: inherit;
    font-family: inherit;
  }

  label {
    white-space: nowrap;

    &:hover {
      background: white;
    }
  }

  :global(.jse-main.jse-focus) {
    box-shadow: 0 2px 10px 0 rgba(0, 0, 0, 0.24);
  }
</style>
