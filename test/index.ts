import { expect } from 'chai';
import { ethers } from 'hardhat';
import { BigNumberish } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  MilkyGovernorDelegate__factory,
  MilkyGovernorDelegate,
  MilkyGovernorDelegator__factory,
  CreamyToken__factory,
  CreamyToken,
  ERC20Mock__factory,
  ERC20Mock
} from '../dist/types'
import {
  TEN_18,
  ZERO_ADDRESS,
  giveCreamy
} from './utils'

const VOTING_PERIOD = ethers.BigNumber.from(151200)
const VOTING_DELAY = ethers.BigNumber.from(1)
const PROPOSAL_THRESHOLD = TEN_18.mul(500000)

describe('MilkyGovernor State', () => {
  let deployer: SignerWithAddress,
      alice: SignerWithAddress,
      bob: SignerWithAddress,
      carol: SignerWithAddress

  let milky: ERC20Mock, creamy: CreamyToken, gov: MilkyGovernorDelegate, govDelegate

  beforeEach(async () => {
    [deployer, alice, bob, carol] = await ethers.getSigners()

    const Milky = new ERC20Mock__factory(deployer)
    milky = await Milky.deploy('MilkySwap Token', 'MILKY', TEN_18.mul(10_000_000))
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

  describe('whitelist', () => {
    beforeEach(async () => {
      await gov._setWhitelistGuardian(alice.address)
    })

    it('sets the whitelist guardian', async () => {
      expect(await gov.whitelistGuardian()).eq(alice.address)
    })

    it('whitelists an address', async () => {
      await gov.connect(alice)._setWhitelistAccountExpiration(bob.address, 9999999999999)
      expect(await gov.whitelistAccountExpirations(bob.address)).eq(9999999999999)
      expect(await gov.isWhitelisted(bob.address)).eq(true)

      await gov.connect(alice)._setWhitelistAccountExpiration(bob.address, 0)
      expect(await gov.whitelistAccountExpirations(bob.address)).eq(0)
      expect(await gov.isWhitelisted(bob.address)).eq(false)
    })
  })

  describe('propose', () => {
    beforeEach(async () => {
      await gov._setWhitelistGuardian(deployer.address)
      await gov._setWhitelistAccountExpiration(deployer.address, 9999999999999)
    })

    it('allows a whitelisted account to propose', async () => {
      const proposalId = (await gov.proposalCount()).add(1)
      await gov.connect(deployer).propose([], [], [], [], 'Test proposal')
      const proposal = await gov.proposals(proposalId)
      expect(await gov.proposalCount()).eq(proposalId)
      expect(proposal.id).eq(proposalId)
      expect(proposal.proposer).eq(deployer.address)
      expect(proposal.eta).eq(0)
      expect(proposal.forVotes).eq(0)
      expect(proposal.againstVotes).eq(0)
      expect(proposal.abstainVotes).eq(0)
      expect(proposal.executed).eq(false)
      expect(proposal.canceled).eq(false)
    })

    it('does not allow an account with insufficient CREAMY to propose', async () => {
      await giveCreamy(milky, creamy, deployer, alice, TEN_18.mul(100_000))
      await expect(
        gov.connect(alice).propose([], [], [], [], 'Test proposal')
      ).to.revertedWith('MilkyGovernor::propose: proposer votes below proposal threshold')
    })

    it('allows an account with enough CREAMY to propose', async () => {
      await giveCreamy(milky, creamy, deployer, bob, TEN_18.mul(750_000))

      const proposalId = (await gov.proposalCount()).add(1)
      await gov.connect(bob).propose([], [], [], [], 'Test proposal')
      const proposal = await gov.proposals(proposalId)
      
      expect(await gov.proposalCount()).eq(proposalId)
      expect(proposal.id).eq(proposalId)
      expect(proposal.proposer).eq(bob.address)
      expect(proposal.eta).eq(0)
      expect(proposal.forVotes).eq(0)
      expect(proposal.againstVotes).eq(0)
      expect(proposal.abstainVotes).eq(0)
      expect(proposal.executed).eq(false)
      expect(proposal.canceled).eq(false)
    })

    it('multiple proposals at once')
  })

  describe('cancel', () => {
    let proposalId: BigNumberish

    beforeEach(async () => {
      proposalId = (await gov.proposalCount()).add(1)
      await gov._setWhitelistGuardian(deployer.address)
      await gov._setWhitelistAccountExpiration(alice.address, 9999999999999)
      await gov.connect(alice).propose([], [], [], [], 'Test proposal')
    })

    it('allows proposer to cancel', async () => {
      await gov.connect(alice).cancel(proposalId)
      expect((await gov.proposals(proposalId)).canceled).eq(true)
    })

    it('allows whitelist guardian to cancel a whitelisted account\'s proposal', async () => {
      await gov.connect(deployer).cancel(proposalId)
      expect((await gov.proposals(proposalId)).canceled).eq(true)
    })
  })

  describe('castVote', () => {
    let proposalId

    beforeEach(async () => {
      proposalId = (await gov.proposalCount()).add(1)
      await gov._setWhitelistGuardian(deployer.address)
      await gov._setWhitelistAccountExpiration(deployer.address, 9999999999999)
      await gov.connect(deployer).propose([], [], [], [], 'Test proposal')
    })

    it('asdf', async () => {

    })
  })

  describe('execute', () => {
    // check every possible proposal state
    it('sets executed to true, emits ProposalExecuted event')
  })

  describe('upgrade', () => {
    it('asdf')
    /**
     * lets you update 
     * MIN_PROPOSAL_THRESHOLD
     * MAX_PROPOSAL_THRESHOLD
     * MIN_VOTING_PERIOD
     * MAX_VOTING_PERIOD
     * MIN_VOTING_DELAY
     * MAX_VOTING_DELAY
     * quorumVotes
     * proposalMaxOperations
     * 
     * Does anything stay the same?
     */
  })
})
