import { Command } from '@oclif/command'
import * as utils from '../../lib/utils'
import chalk from 'chalk'
import * as fs from 'fs-extra'
import * as path from 'path'
import { get, cancelled } from '../../lib/prompt'
import constants from '../../lib/constants.json'

export default class MetadataDelete extends Command {
  static description = 'delete token from local metadata'
  async run() {
    try {
      const provider = await utils.getProvider(this)
      const chainId = (await provider.getNetwork()).chainId

      this.log()
      utils.displayDescription(this, MetadataDelete.description, chainId)

      let metadataPath = path.join(this.config.configDir, 'metadata-rinkeby.json')
      if (String(chainId) === constants.chainIds.MAINNET) {
        metadataPath = path.join(this.config.configDir, 'metadata-mainnet.json')
      }

      const { needle }: any = await get({
        needle: {
          description: 'ticker or address',
          type: 'String',
        },
      })

      let metadata = {
        byAddress: {},
        bySymbol: {},
      }

      if (await fs.pathExists(metadataPath)) {
        metadata = require(metadataPath)
      }

      let token

      if (needle.toUpperCase() in metadata.bySymbol) {
        token = metadata.bySymbol[needle.toUpperCase()]
      }
      if (needle in metadata.byAddress) {
        token = metadata.byAddress[needle]
      }

      this.log()
      if (!token) {
        this.log('Token not found in metadata.\n')
      } else {
        this.log(
          `${token.name} (${token.fullName}) · https://${constants.etherscanDomains[chainId]}/address/${token.addr} · ${token.decimals} decimals`,
        )

        const { confirm }: any = await get({
          confirm: {
            description: chalk.white(`\nType "yes" to remove this token (${token.name}) from local metadata`),
          },
        })
        if (confirm === 'yes') {
          delete metadata.byAddress[token.addr]
          delete metadata.bySymbol[token.name]

          await fs.outputJson(metadataPath, metadata)
          this.log(chalk.green('Local metadata updated\n'))
        } else {
          this.log('\nCancelled.\n')
        }
      }
    } catch (e) {
      cancelled(e)
    }
  }
}
