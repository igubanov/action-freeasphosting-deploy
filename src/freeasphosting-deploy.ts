import { IncomingMessage, request } from 'http'
import { Buffer } from 'node:buffer'
import { readFile } from 'fs'
import { debug, error, info } from './logger'

const serverUrl = 'freeasphosting.net'
const diskSize = '5000'

export async function deployToFreeasphosting(
  login: string,
  password: string,
  zipFilePath: string
): Promise<void> {
  const result = await makeRequest({ path: '' })

  if (!result) {
    error(`reuqest to ${serverUrl} is failed`)
    return
  }

  const allCookies = result.response.headers['set-cookie']
  if (!allCookies) {
    error(`Response doesnt contains cookies`)
    return
  }

  const cookie = allCookies.find(x => x.startsWith('ASP.NET_SessionId'))
  if (!cookie) {
    error(`Cookies doenst include ASP.NET_SessionId`)
    return
  }

  debug(`get cookie: ${cookie}`)

  if (await loginToSite(login, password, cookie)) {
    debug(`successfull authorized`)
  } else {
    error(`login failed`)
    return
  }

  await uploadFile(login, cookie, zipFilePath)
  return
}

async function makeRequest(opt: {
  path: string
  method?: 'GET' | 'POST'
  cookie?: string
  body?: string | Buffer
  contentType?: string
  headers?: { title: string; value: string }[]
}): Promise<{ response: IncomingMessage; body: string }> {
  return new Promise(function (resolve, reject) {
    const req = request(
      {
        host: serverUrl,
        path: opt.path,
        method: opt.method ?? 'GET'
      },
      res => {
        const chunks: Uint8Array[] = []
        res.on('data', chunk => {
          chunks.push(chunk as Uint8Array)
        })

        res.on('end', () => {
          resolve({ response: res, body: Buffer.concat(chunks).toString() })
        })

        res.on('error', err => {
          reject(err)
        })
      }
    )

    if (opt.cookie) {
      req.setHeader('Cookie', opt.cookie)
    }

    if (opt.contentType) {
      req.setHeader('Content-Type', opt.contentType)
    }

    if (opt.headers) {
      for (var header of opt.headers) {
        req.setHeader(header.title, header.value)
      }
    }

    if (opt.method === 'POST' && opt.body) {
      req.setHeader('Content-Length', opt.body.length)
      req.write(opt.body)
    }

    req.end()
  })
}

async function loginToSite(
  login: string,
  password: string,
  cookie: string
): Promise<boolean> {
  const body = `__EVENTTARGET=&__EVENTARGUMENT=&__VIEWSTATE=%2FwEPDwUKMjExNTgwNTg1MGRk0DiomOI85QuZT8iUkfl%2FGMqIvIKci2OW55DIihCt9Vc%3D&__VIEWSTATEGENERATOR=CA0B0334&__EVENTVALIDATION=%2FwEdAAolTYjub%2FqP8bIdJrJE0oJcVK7BrRAtEiqu9nGFEI%2BjB3Y2%2BMc6SrnAqio3oCKbxYai7c8d%2BSPBnvYjdu1GYhDkQwdmH1m48FGJ7a8D8d%2BhElQkXmq%2FPiIM8AyUUnUa9BqqWMSXKfhrvr8S6ZbPNyfB0V9lfkNohFh6jrQCuWRMANMgwQhAgrN8SxHOPE44gPXO6Z4Gpe2BT9AOke3QILxxQhYFloM4uottxhMECc21VTxrqZdi9WDnxd2w7wp9NW4%3D&txtUsername=${login}&txtPassword=${password}&btnSign=Log+In&txtEmail=&txtUsernameRegFront=&txtUsernameReg=&txtPasswordReg="`
  const response = await makeRequest({
    path: '',
    method: 'POST',
    body,
    cookie,
    contentType: 'application/x-www-form-urlencoded'
  })
  if (response.response.complete && response.response.statusCode === 302) {
    return true
  }
  debug(
    `login failed, status code ${response.response.statusCode},` +
      ` response headers: ${response.response.headers}, body:`
  )
  debug(response.body)
  return false
}

async function getMetadata(cookie: string): Promise<object> {
  info('try get metadata')
  // request needed to get at the next right parameters
  await makeRequest({
    path: '/cp/fileManager.aspx',
    cookie,
    method: 'GET'
  })

  const result = await makeRequest({
    path: '/cp/browsezip.aspx',
    cookie,
    method: 'GET'
  })

  const homeDir_Path = result.body
    .match('id="ContentPlaceHolder1_hdnDirHome" value="([^"]+)"')
    ?.at(1)
  if (!homeDir_Path) {
    error(`cant find homeDir_Path`)
  }

  const DomainName = result.body
    .match('id="ContentPlaceHolder1_DomainName" value="([^"]+)"')
    ?.at(1)
  if (!DomainName) {
    error(`cant find DomainName`)
  }

  const Username = result.body
    .match('id="ContentPlaceHolder1_hdnUsername" value="([^"]+)"')
    ?.at(1)
  if (!Username) {
    error(`cant find Username`)
  }

  const UID = result.body
    .match('id="ContentPlaceHolder1_hdnUID" value="([^"]+)"')
    ?.at(1)
  if (!UID) {
    error(`cant find UID`)
  }

  const metadata = {
    homeDir_Path,
    Allocated_Disk: diskSize,
    DomainName,
    UID,
    Username
  }

  debug(`loded metadata: ${JSON.stringify(metadata)}`)
  return metadata
}

async function uploadFile(
  login: string,
  cookie: string,
  filePath: string
): Promise<void> {
  debug(`start uploadFile method, reading file`)
  readFile(filePath, async function (err, content) {
    if (err) {
      error(`cant open file ${filePath}`)
      debug(err.toString())
      return false
    }

    const metadata = await getMetadata(cookie)
    const boundary = '----WebKitFormBoundaryWPx2221231321'

    debug('start building body for uploading')
    const payload = buildBodyForUploadZip(content, metadata, boundary)

    debug(`start uploading file request`)
    const result = await makeRequest({
      path: `/cp/FileUploadHandler.ashx?upload=start&intTotalDisk=${diskSize}`,
      body: payload,
      contentType: `multipart/form-data; boundary=${boundary}`,
      cookie,
      method: 'POST',
      headers: [
        {
          title: 'referer',
          value: 'https://freeasphosting.net/cp/browsezip.aspx'
        }
      ]
    })

    debug(
      `upload file complete, status code ${result.response.statusCode}, ` +
        `response body: ${result.body}`
    )

    // console.log('@' + result.body.toString() + '@')
    // console.log(result.response.statusCode)

    if (
      result.response.statusCode === 200 &&
      result.body.includes('Uploaded') &&
      result.body.includes('True')
    ) {
      info('file successful upload')
    } else {
      error(`files doesnt upload`)
      debug(
        `Probably file havent uploaded, response code: ${result.response.statusCode}, message: ${result.body}`
      )
    }
  })
}

function buildBodyForUploadZip(
  content: Buffer,
  metadata: {},
  boundary: string
): Buffer {
  let data = ''
  for (let fieldName in metadata) {
    if ({}.hasOwnProperty.call(metadata, fieldName)) {
      data += `--${boundary}\r\n`
      data += `Content-Disposition: form-data; name="${fieldName}"; \r\n\r\n`
      data += `${metadata[fieldName as keyof typeof metadata]}\r\n`
    }
  }

  data += `--${boundary}\r\n`
  data +=
    'Content-Disposition: form-data; name="files[]"; filename="filename.zip"\r\n'
  data += 'Content-Type: application/x-zip-compressed\r\n\r\n'
  //data += 'Content-Type: application/octet-stream\r\n\r\n'

  return Buffer.concat([
    Buffer.from(data, 'utf-8'),
    Buffer.from(content),
    Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')
  ])
}
