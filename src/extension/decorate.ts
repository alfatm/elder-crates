import {
  type DecorationOptions,
  MarkdownString,
  type TextEditor,
  type TextEditorDecorationType,
  ThemeColor,
  window,
} from 'vscode'
import {
  type AdvisoryMap,
  checkAdvisories,
  DOCS_RS_URL,
  formatAdvisoriesForHover,
  formatDependencyResult,
  SYMBOL_ADVISORY,
  validateCargoTomlContent,
} from '../core/index.js'
import type { DependencyStatus, ValidatorConfig } from '../core/types.js'
import { buildValidatorConfig, loadConfigForScope, VSCODE_USER_AGENT } from './config.js'
import log from './log.js'

// Create decoration types for each status with appropriate colors
const DECORATION_TYPES: Record<DependencyStatus, TextEditorDecorationType> = {
  latest: window.createTextEditorDecorationType({
    after: {
      margin: '2em',
      color: new ThemeColor('editorInfo.foreground'),
    },
  }),
  'patch-behind': window.createTextEditorDecorationType({
    after: {
      margin: '2em',
      color: new ThemeColor('editorWarning.foreground'),
    },
  }),
  'minor-behind': window.createTextEditorDecorationType({
    after: {
      margin: '2em',
      color: new ThemeColor('editorWarning.foreground'),
    },
  }),
  'major-behind': window.createTextEditorDecorationType({
    after: {
      margin: '2em',
      color: new ThemeColor('editorError.foreground'),
    },
  }),
  error: window.createTextEditorDecorationType({
    after: {
      margin: '2em',
      color: new ThemeColor('editorError.foreground'),
    },
  }),
}

const ALL_STATUSES: DependencyStatus[] = ['latest', 'patch-behind', 'minor-behind', 'major-behind', 'error']

export async function decorate(editor: TextEditor) {
  const fileName = editor.document.fileName
  log.info(`${fileName} - decorating file`)
  const scope = editor.document.uri
  const start = Date.now()

  // Load cargo registries before processing dependencies
  await loadConfigForScope(scope)

  // Build validator config from extension settings
  const baseConfig = buildValidatorConfig(scope)
  const config: ValidatorConfig = {
    ...baseConfig,
    fetchOptions: {
      logger: log,
      userAgent: VSCODE_USER_AGENT,
    },
  }

  // Run version validation and advisory check in parallel
  const [result, advisoryResult] = await Promise.all([
    validateCargoTomlContent(editor.document.getText(), fileName, config),
    checkAdvisories(fileName, log),
  ])

  if (result.parseError) {
    log.error(`${fileName} - parse error: ${result.parseError.message}`)
    return
  }

  const advisories: AdvisoryMap = advisoryResult.advisories
  if (advisoryResult.available) {
    if (advisoryResult.error) {
      log.warn(`${fileName} - cargo-deny error: ${advisoryResult.error}`)
    } else {
      log.info(`${fileName} - cargo-deny found ${advisories.size} packages with advisories`)
    }
  } else {
    log.debug(`${fileName} - cargo-deny not available, skipping advisory check`)
  }

  const docsUrl = DOCS_RS_URL.toString()

  // Group decorations by status for colored styling
  const decorationsByStatus: Record<DependencyStatus, DecorationOptions[]> = {
    latest: [],
    'patch-behind': [],
    'minor-behind': [],
    'major-behind': [],
    error: [],
  }

  for (const depResult of result.dependencies) {
    const { status, decoration, hoverMarkdown, updateVersion } = formatDependencyResult(depResult, docsUrl)
    const crateName = depResult.dependency.name

    // Check if this crate has security advisories
    const crateAdvisories = advisories.get(crateName) ?? []
    const hasAdvisories = crateAdvisories.length > 0

    // Build hover message with optional update command and advisories
    const hoverMessage = new MarkdownString(hoverMarkdown)
    hoverMessage.isTrusted = true

    // Add update button if there's a newer version available
    if (updateVersion && depResult.dependency.source.type === 'registry') {
      const commandArgs = encodeURIComponent(
        JSON.stringify({
          filePath: fileName,
          line: depResult.dependency.line,
          newVersion: updateVersion,
          crateName: crateName,
        }),
      )
      hoverMessage.appendMarkdown(
        `\n\n[⬆️ Update to ${updateVersion}](command:fancy-crates.updateDependency?${commandArgs})`,
      )
    }

    // Add advisory information to hover if present
    if (hasAdvisories) {
      hoverMessage.appendMarkdown(formatAdvisoriesForHover(crateAdvisories))
    }

    // Add advisory emoji to decoration if there are security issues
    const finalDecoration = hasAdvisories ? `${SYMBOL_ADVISORY} ${decoration}` : decoration

    decorationsByStatus[status].push({
      range: editor.document.lineAt(depResult.dependency.line).range,
      hoverMessage,
      renderOptions: {
        after: {
          contentText: finalDecoration,
        },
      },
    })
  }

  // Apply decorations for each status (clear empty ones too to remove stale decorations)
  for (const status of ALL_STATUSES) {
    editor.setDecorations(DECORATION_TYPES[status], decorationsByStatus[status])
  }

  log.info(`${fileName} - file decorated in ${Math.round((Date.now() - start) / 10) / 100} seconds`)
}
