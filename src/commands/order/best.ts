import { ethers } from 'ethers'
import chalk from 'chalk'
import { Command } from '@oclif/command'
import * as utils from '../../lib/utils'
import { printOrder, confirm, cancelled } from '../../lib/prompt'
import * as requests from '../../lib/requests'

const Swap = require('@airswap/swap/build/contracts/Swap.json')
const swapDeploys = require('@airswap/swap/deploys.json')

export default class OrderBest extends Command {
  static description = 'get the best available order'
  async run() {
    try {
      const wallet = await utils.getWallet(this)
      const chainId = (await wallet.provider.getNetwork()).chainId
      const metadata = await utils.getMetadata(this, chainId)
      const protocol = await utils.getProtocol(this)
      utils.displayDescription(this, OrderBest.description, chainId)

      const request = await requests.getRequest(wallet, metadata, 'Order')
      this.log()

      requests.multiPeerCall(wallet, request.method, request.params, protocol, async (order: any, locator: string) => {
        this.log()
        if (!order) {
          this.log(chalk.yellow('No valid responses received.\n'))
        } else {
          const swapAddress = swapDeploys[chainId]
          await printOrder(this, request, locator, order, wallet, metadata)
          const errors = await utils.verifyOrder(request, order, swapAddress, wallet, metadata)

          if (errors.length) {
            this.log(chalk.yellow('Unable to take this order.'))
            for (const e in errors) {
              this.log(`‣ ${errors[e]}`)
            }
            this.log()
          } else {
            if (
              await confirm(
                this,
                metadata,
                'swap',
                {
                  signerWallet: order.signer.wallet,
                  signerToken: order.signer.token,
                  signerAmount: `${order.signer.amount} (${chalk.cyan(
                    utils.getDecimalValue(order.signer.amount, request.signerToken.addr, metadata).toFixed(),
                  )})`,
                  senderWallet: `${order.sender.wallet} (${chalk.cyan('You')})`,
                  senderToken: order.sender.token,
                  senderAmount: `${order.sender.amount} (${chalk.cyan(
                    utils.getDecimalValue(order.sender.amount, request.senderToken.addr, metadata).toFixed(),
                  )})`,
                },
                chainId,
                'take this order',
              )
            ) {
              new ethers.Contract(swapAddress, Swap.abi, wallet)
                .swap(order)
                .then(utils.handleTransaction)
                .catch(utils.handleError)
            }
          }
        }
      })
    } catch (e) {
      cancelled(e)
    }
  }
}
