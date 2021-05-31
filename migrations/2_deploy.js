
const CA = artifacts.require("CronAggregator");
// 1581296400 : 01:00:0
// 1581296100 : 00:55:0

module.exports = function(deployer) {
  if(process.argv[5] === "deploy") {
    let isUnique = process.argv[11].toLowerCase() == true || process.argv[11] === "1"
    deployer.deploy(CA, process.argv[6], process.argv[7], process.argv[8], process.argv[9], process.argv[10], isUnique, process.argv[12].split(","));
  }
};
