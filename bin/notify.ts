/**
 * Cross-platform notification utility for dev server events
 * Uses node-notifier for native OS notifications
 */

import path from 'path'
import { fileURLToPath } from 'url'
import notifier from 'node-notifier'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error'

export interface NotificationOptions {
  title: string
  message: string
  level?: NotificationLevel
}

/**
 * Send a native OS notification
 * Can be disabled by setting ENABLE_NOTIFICATIONS=false
 */
export function notify(options: NotificationOptions): void {
  const enabled = process.env.ENABLE_NOTIFICATIONS !== 'false'

  if (!enabled) {
    return
  }

  const { title, message, level = 'info' } = options

  // Add emoji prefix based on level
  const prefix = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌',
  }[level]

  notifier.notify({
    title,
    message: `${prefix} ${message}`,
    sound: level === 'error' || level === 'warning',
    // On macOS, use icon path if available
    icon: path.join(__dirname, '..', 'assets', 'logo-banner.png'),
    // Wait for notification to be dismissed or timeout
    wait: false,
    timeout: 5,
  })
}

/**
 * Convenience method for info notifications
 */
export function notifyInfo(title: string, message: string): void {
  notify({ title, message, level: 'info' })
}

/**
 * Convenience method for success notifications
 */
export function notifySuccess(title: string, message: string): void {
  notify({ title, message, level: 'success' })
}

/**
 * Convenience method for warning notifications
 */
export function notifyWarning(title: string, message: string): void {
  notify({ title, message, level: 'warning' })
}

/**
 * Convenience method for error notifications
 */
export function notifyError(title: string, message: string): void {
  notify({ title, message, level: 'error' })
}
