import { expect } from "chai";
import { ethers } from "hardhat";

describe("ZillobEscrow", function () {
  it("accepts deposits and owner can release", async function () {
    const [owner, buyer, seller] = await ethers.getSigners();
    const Escrow = await ethers.getContractFactory("ZillobEscrow");
    const escrow = await Escrow.deploy(owner.address);

    await escrow.connect(buyer).deposit(1, { value: ethers.parseEther("1") });
    expect(await escrow.deposits(1)).to.equal(ethers.parseEther("1"));

    const before = await ethers.provider.getBalance(seller.address);
    await escrow.connect(owner).release(1, seller.address);
    const after = await ethers.provider.getBalance(seller.address);

    expect(after).to.be.gt(before);
    expect(await escrow.deposits(1)).to.equal(0n);
  });
});
