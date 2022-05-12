import { expect } from 'chai';
import { ethers, network } from 'hardhat';
import { BigNumberish } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  MilkyGovernorDelegate__factory,
  MilkyGovernorDelegate,
  MilkyGovernorDelegator__factory,
  MilkyGovernorDelegator,
  MockGovernorUpgrade__factory,
  Timelock__factory,
  CreamyToken__factory,
  CreamyToken,
  ERC20Mock__factory,
  ERC20Mock
} from '../dist/types'
import {
  TEN_18,
  ZERO_ADDRESS,
  giveCreamy,
  mineToBlock,
  Support,
  ProposalState
} from './utils'

const VOTING_PERIOD = ethers.BigNumber.from(20) // should be 1 week in production: 151200
const VOTING_DELAY = ethers.BigNumber.from(1)
const PROPOSAL_THRESHOLD = TEN_18.mul(500000)

const NEW_VOTING_PERIOD = ethers.BigNumber.from(151200) // should be 1 week in production: 151200
const NEW_VOTING_DELAY = ethers.BigNumber.from(151200)
const NEW_PROPOSAL_THRESHOLD = TEN_18.mul(1000000)

describe('MilkyGovernor State', () => {
  let deployer: SignerWithAddress,
      alice: SignerWithAddress,
      bob: SignerWithAddress,
      carol: SignerWithAddress

  let milky: ERC20Mock, creamy: CreamyToken, gov: MilkyGovernorDelegate, govDelegator: MilkyGovernorDelegator, govDelegate

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

    const GovDelegator = new MilkyGovernorDelegator__factory(deployer)
    govDelegator = await GovDelegator.deploy(
      ZERO_ADDRESS,
      creamy.address,
      deployer.address,
      govDelegate.address,
      VOTING_PERIOD,
      VOTING_DELAY,
      PROPOSAL_THRESHOLD,
    )
    await govDelegator.deployed()

    gov = govDelegate.attach(govDelegator.address) as MilkyGovernorDelegate
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
      expect(await gov.proposalCount()).eq(proposalId)

      const proposal = await gov.proposals(proposalId)
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

    it('does not let an account make another proposal when pending', async () => {
      await gov.connect(deployer).propose([], [], [], [], 'Test proposal')
      
      await expect(
        gov.connect(deployer).propose([], [], [], [], 'Test Proposal 2')
      ).revertedWith('MilkyGovernor::propose: one live proposal per proposer, found an already pending proposal')
    })

    it('does not let an account make another proposal when active', async () => {
      const proposalId = (await gov.proposalCount()).add(1)
      await gov.connect(deployer).propose([], [], [], [], 'Test proposal')
      const proposal = await gov.proposals(proposalId)
      await mineToBlock(proposal.startBlock)
      
      await expect(
        gov.connect(deployer).propose([], [], [], [], 'Test Proposal 2')
      ).revertedWith('MilkyGovernor::propose: one live proposal per proposer, found an already active proposal')
    })

    it('allows multiple proposals at once', async () => {
      await giveCreamy(milky, creamy, deployer, alice, TEN_18.mul(1_000_000))

      const proposalId1 = (await gov.proposalCount()).add(1)
      await gov.connect(deployer).propose([], [], [], [], 'Test proposal')
      const proposalId2 = (await gov.proposalCount()).add(1)
      await gov.connect(alice).propose([], [], [], [], 'Test proposal')

      const proposal1 = await gov.proposals(proposalId1)
      const proposal2 = await gov.proposals(proposalId2)
      expect(proposal1.proposer).eq(deployer.address)
      expect(proposal2.proposer).eq(alice.address)
    })
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
    let proposalId: BigNumberish
    let proposal: any
    const CREAMY_TRANSFER = TEN_18.mul(1_000_000)
    const ROUGH_CREAMY_BALANCE = TEN_18.mul(990_000) // hard to get exact balances with CREAMY

    beforeEach(async () => {
      proposalId = (await gov.proposalCount()).add(1)

      await giveCreamy(milky, creamy, deployer, alice, CREAMY_TRANSFER)
      await giveCreamy(milky, creamy, deployer, bob, CREAMY_TRANSFER)
      await giveCreamy(milky, creamy, deployer, carol, CREAMY_TRANSFER)

      await gov._setWhitelistGuardian(deployer.address)
      await gov._setWhitelistAccountExpiration(deployer.address, 9999999999999)
      await gov.connect(deployer).propose([], [], [], [], 'Test proposal')

      // only need to mine once if VOTING_DELAY is one block
      proposal = await gov.proposals(proposalId)
      await mineToBlock(proposal.startBlock)
    })

    it('reverts on incorrect vote', async () => {
      await expect(
        gov.connect(alice).castVote(proposalId, 3)
      ).to.revertedWith('MilkyGovernor::castVoteInternal: invalid vote type')
    })

    it('casts for, againt, and abstain votes', async () => {
      await gov.connect(alice).castVote(proposalId, Support.FOR)
      await gov.connect(bob).castVote(proposalId, Support.AGAINST)
      await gov.connect(carol).castVote(proposalId, Support.ABSTAIN)

      const aReceipt = await gov.getReceipt(proposalId, alice.address)
      expect(aReceipt.hasVoted).eq(true)
      expect(aReceipt.support).eq(Support.FOR)
      expect(aReceipt.votes).gt(ROUGH_CREAMY_BALANCE)

      const bReceipt = await gov.getReceipt(proposalId, bob.address)
      expect(bReceipt.hasVoted).eq(true)
      expect(bReceipt.support).eq(Support.AGAINST)
      expect(bReceipt.votes).gt(ROUGH_CREAMY_BALANCE)

      const cReceipt = await gov.getReceipt(proposalId, carol.address)
      expect(cReceipt.hasVoted).eq(true)
      expect(cReceipt.support).eq(Support.ABSTAIN)
      expect(cReceipt.votes).gt(ROUGH_CREAMY_BALANCE)

      const proposal = await gov.proposals(proposalId)
      expect(proposal.forVotes).gt(ROUGH_CREAMY_BALANCE)
      expect(proposal.againstVotes).gt(ROUGH_CREAMY_BALANCE)
      expect(proposal.abstainVotes).gt(ROUGH_CREAMY_BALANCE)
    })

    it('does not allow account to change vote', async () => {
      await gov.connect(alice).castVote(proposalId, Support.FOR)
      await expect(
        gov.connect(alice).castVote(proposalId, Support.AGAINST)
      ).to.revertedWith('MilkyGovernor::castVoteInternal: voter already voted')
    })

    it('does not allow users to vote if it has closed', async () => {
      await mineToBlock(proposal.endBlock)
      await expect(
        gov.connect(alice).castVote(proposalId, Support.FOR)
      ).to.revertedWith('MilkyGovernor::castVoteInternal: voting is closed')
    })
  })

  describe('state', () => {
    let proposalId: BigNumberish
    let proposal: any
    const BELOW_QUORUM = TEN_18.mul(300_000)
    const ABOVE_QUORUM = TEN_18.mul(1_000_000)

    beforeEach(async () => {
      proposalId = (await gov.proposalCount()).add(1)

      await giveCreamy(milky, creamy, deployer, alice, BELOW_QUORUM)
      await giveCreamy(milky, creamy, deployer, bob, ABOVE_QUORUM)
      // await giveCreamy(milky, creamy, deployer, carol, CREAMY_TRANSFER)

      await gov._setWhitelistGuardian(deployer.address)
      await gov._setWhitelistAccountExpiration(deployer.address, 9999999999999)
      await gov.connect(deployer).propose([], [], [], [], 'Test proposal')
      
      proposal = await gov.proposals(proposalId)
    })

    it('pends', async () => {
      expect(await gov.state(proposalId)).eq(ProposalState.PENDING)
    })

    it('activates', async () => {
      await mineToBlock(proposal.startBlock)
      expect(await gov.state(proposalId)).eq(ProposalState.ACTIVE)
    })

    it('cancels', async () => {
      await gov.connect(deployer).cancel(proposalId)
      expect(await gov.state(proposalId)).eq(ProposalState.CANCELED)
    })

    it('defeats when against', async () => {
      await mineToBlock(proposal.startBlock)
      await gov.connect(bob).castVote(proposalId, Support.AGAINST)
      await mineToBlock(proposal.endBlock)

      expect(await gov.state(proposalId)).eq(ProposalState.DEFEATED)
    })

    it('defeats when quorum is not reached', async () => {
      await mineToBlock(proposal.startBlock)
      await gov.connect(alice).castVote(proposalId, Support.FOR)
      await mineToBlock(proposal.endBlock)

      expect(await gov.state(proposalId)).eq(ProposalState.DEFEATED)
    })

    it('succeeds', async () => {
      await mineToBlock(proposal.startBlock)
      await gov.connect(bob).castVote(proposalId, Support.FOR)
      await mineToBlock(proposal.endBlock)

      expect(await gov.state(proposalId)).eq(ProposalState.SUCCEEDED)
    })

    it('executes', async () => {
      await mineToBlock(proposal.startBlock)
      await gov.connect(bob).castVote(proposalId, Support.FOR)
      await mineToBlock(proposal.endBlock)
      await gov.execute(proposalId)

      expect(await gov.state(proposalId)).eq(ProposalState.EXECUTED)

      const newProposalState = await gov.proposals(proposalId)
      expect(newProposalState.executed).eq(true)
    })
  })

  describe('upgrade', () => {
    beforeEach(async () => {
      const Timelock = new Timelock__factory(deployer)
      const timelock = await Timelock.deploy(deployer.address, 259200) // 3 days

      const NewGovDelegate = new MockGovernorUpgrade__factory(deployer)
      const newGovDelegate = await NewGovDelegate.deploy()

      await govDelegator._setImplementation(newGovDelegate.address)
      
      gov = newGovDelegate.attach(govDelegator.address) as MilkyGovernorDelegate
      
      await gov.initialize(
        timelock.address,
        creamy.address,
        NEW_VOTING_PERIOD,
        NEW_VOTING_DELAY,
        NEW_PROPOSAL_THRESHOLD,
      )
    })

    it('sets all variables', async () => {
      expect(await gov.MIN_VOTING_DELAY()).eq(21600)
      expect(await gov.MAX_VOTING_DELAY()).eq(216000)
      expect(await gov.MIN_VOTING_PERIOD()).eq(21600)
      expect(await gov.MAX_VOTING_PERIOD()).eq(282240)
      expect(await gov.MIN_PROPOSAL_THRESHOLD()).eq(TEN_18.mul(600000))
      expect(await gov.MAX_PROPOSAL_THRESHOLD()).eq(TEN_18.mul(2000000))
      expect(await gov.votingDelay()).eq(NEW_VOTING_DELAY)
      expect(await gov.votingPeriod()).eq(NEW_VOTING_PERIOD)
      expect(await gov.proposalThreshold()).eq(NEW_PROPOSAL_THRESHOLD)
      expect(await gov.quorumVotes()).eq(TEN_18.mul(500000))
    })
  })
})
