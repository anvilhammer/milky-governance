import { ethers, network } from 'hardhat'
import { BigNumber, BigNumberish } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  CreamyToken,
  ERC20Mock
} from '../dist/types'

export const TEN_18 = BigNumber.from('1000000000000000000')
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
export const FOUR_YEARS = BigNumber.from('126144000')

export async function getLastBlockTimestamp() {
  const blockNumBefore = await ethers.provider.getBlockNumber();
  const blockBefore = await ethers.provider.getBlock(blockNumBefore);
  return blockBefore.timestamp;
}

export async function giveCreamy(
  milky: ERC20Mock,
  creamy: CreamyToken,
  funder: SignerWithAddress,
  to: SignerWithAddress,
  amount: BigNumberish
) {
  const lastTimestamp = await getLastBlockTimestamp()
  const lockEnd = FOUR_YEARS.add(lastTimestamp)

  await milky.connect(funder).transfer(to.address, amount)
  await milky.connect(to).approve(creamy.address, amount)
  await creamy.connect(to).create_lock(amount, lockEnd, { gasLimit: 30000000 })
}

export async function mineToBlock(blockNumber: BigNumber) {
  const blockNumBefore = await ethers.provider.getBlockNumber();
  const blocksToMine = blockNumber.sub(blockNumBefore).toNumber()
  for (let i = 0; i <= blocksToMine; i++) {
    await network.provider.request({ method: "evm_mine", params: [] });
  }
}

export enum Support {
  AGAINST,
  FOR,
  ABSTAIN,
}

export enum ProposalState {
  PENDING,
  ACTIVE,
  CANCELED,
  DEFEATED,
  SUCCEEDED,
  QUEUED,
  EXPIRED,
  EXECUTED
}