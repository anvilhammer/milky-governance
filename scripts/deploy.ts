import { run, ethers, network } from "hardhat";
import {
  MilkyGovernorDelegate__factory,
  MilkyGovernorDelegator__factory,
} from '../dist/types'
import fs from 'fs';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

type Config = {
  creamy: string;
  votingPeriod: string;
  votingDelay: string;
  proposalThreshold: string;
}

async function main() {
  await run("compile");

  const [deployer] = await ethers.getSigners();

  console.log(`Deploying contracts with from: ${deployer.address}`);

  const config: Config = require(`${process.cwd()}/addresses/${network.config.chainId}/config.json`);

  const GovDelegate = new MilkyGovernorDelegate__factory(deployer)
  const govDelegate = await GovDelegate.deploy()
  await govDelegate.deployed()
  console.log(`MilkyGovernorDelegate deployed to ${govDelegate.address}`);

  const GovDelegator = new MilkyGovernorDelegator__factory(deployer)
  const govDelegator = await GovDelegator.deploy(
    ZERO_ADDRESS,
    config.creamy,
    deployer.address,
    govDelegate.address,
    config.votingPeriod,
    config.votingDelay,
    config.proposalThreshold,
  )
  await govDelegator.deployed()
  console.log(`MilkyGovernorDelegator deployed to ${govDelegator.address}`);

  const addressPath = `${process.cwd()}/addresses/${network.config.chainId}/gov.json`;
  const addressBook = {
    deployer: deployer.address,
    delegate: govDelegate.address,
    delegator: govDelegator.address,
  };

  fs.writeFileSync(
    addressPath,
      JSON.stringify(addressBook, null, 2)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
