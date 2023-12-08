import * as core from '@actions/core'

export function info(message: string) {
  core.info(message)
}

export function debug(message: string) {
  core.debug(message)
}

export function error(message: string) {
  core.error(message)
}
