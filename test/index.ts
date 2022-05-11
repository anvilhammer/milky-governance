import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  MilkyGovernorDelegate__factory,
  MilkyGovernorDelegate,
  MilkyGovernorDelegator__factory,
  CreamyToken__factory,
  CreamyToken,
  ERC20Mock__factory,
} from '../dist/types'
import {
  TEN_18,
  ZERO_ADDRESS,
} from './utils'

const VOTING_PERIOD = ethers.BigNumber.from(151200)
const VOTING_DELAY = ethers.BigNumber.from(1)
const PROPOSAL_THRESHOLD = TEN_18.mul(50000)

describe('MilkyGovernor State', () => {
  let deployer: SignerWithAddress,
      alice: SignerWithAddress,
      bob: SignerWithAddress,
      carol: SignerWithAddress

  let milky, creamy: CreamyToken, gov: MilkyGovernorDelegate, govDelegate

  before(async () => {
    [deployer, alice, bob, carol] = await ethers.getSigners()

    const Milky = new ERC20Mock__factory(deployer)
    milky = await Milky.deploy('MilkySwap Token', 'MILKY', TEN_18.mul(1_000_000))
    await milky.deployed()

    const Creamy = new CreamyToken__factory(deployer)
    creamy = await Creamy.deploy(milky.address, 'CREAMY', 'CREAMY', '1')
    await creamy.deployed()

    const GovDelegate = new MilkyGovernorDelegate__factory(deployer)
    govDelegate = await GovDelegate.deploy()
    await govDelegate.deployed()

    const GovInstance = new MilkyGovernorDelegator__factory(deployer)
    const govInstance = await GovInstance.deploy(
      ZERO_ADDRESS,
      creamy.address,
      deployer.address,
      govDelegate.address,
      VOTING_PERIOD,
      VOTING_DELAY,
      PROPOSAL_THRESHOLD,
    )
    await govInstance.deployed()

    gov = govDelegate.attach(govInstance.address) as MilkyGovernorDelegate
    await gov._initiate(ZERO_ADDRESS)
  })

  describe('initialize', () => {
    it('Set correct initial values', async () => {
      expect(await gov.admin()).eq(deployer.address)
      expect(await gov.initialProposalId()).eq(1)
      expect(await gov.creamy()).eq(creamy.address)
      expect(await gov.votingDelay()).eq(VOTING_DELAY)
      expect(await gov.votingPeriod()).eq(VOTING_PERIOD)
      expect(await gov.timelock()).eq(ZERO_ADDRESS)
      expect(await gov.proposalThreshold()).eq(PROPOSAL_THRESHOLD)
    })
  })

  describe('propose', () => {
    it('asdf')
  })

  describe('castVote', () => {
    it('asdf')
  })

  describe('whitelist', () => {
    it('asdf')
  })

  describe('upgrade', () => {
    it('asdf')
  })
})
