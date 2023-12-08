import * as core from '@actions/core'

export function info(message: string): void {
  core.info(message)
}

export function debug(message: string): void {
  core.debug(message)
}

export function error(message: string): void {
  core.error(message)
}
