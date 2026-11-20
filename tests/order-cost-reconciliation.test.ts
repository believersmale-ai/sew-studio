import assert from "node:assert/strict";
import {roundCost,sumLines,validLines} from "../src/lib/order-cost-reconciliation";
const estimated=validLines([
 {key:"materials",label:"Fabric",amount:300},
 {key:"wastage",label:"Wastage",amount:15},
 {key:"labour",label:"Labour",amount:200},
 {key:"overhead",label:"Overhead",amount:35},
]);
assert.ok(estimated);
assert.equal(sumLines(estimated),550);
const actual=validLines([
 {key:"materials",label:"Fabric",amount:350},
 {key:"wastage",label:"Wastage",amount:15},
 {key:"labour",label:"Labour",amount:190},
 {key:"overhead",label:"Overhead",amount:35},
 {key:"extra_zip",label:"Forgotten zip",amount:10},
]);
assert.ok(actual);
assert.equal(sumLines(actual),600);
assert.equal(roundCost(850-sumLines(estimated)),300);
assert.equal(roundCost(850-sumLines(actual)),250);
assert.equal(roundCost((850-sumLines(actual))/850*100),29.41);
assert.equal(Math.abs(sumLines(actual)-sumLines(estimated))/sumLines(estimated)<=0.1,true);
assert.equal(validLines([{key:"materials",label:"Fabric",amount:-1}]),null);
assert.equal(validLines([{key:"same",label:"A",amount:1},{key:"same",label:"B",amount:2}]),null);
console.log("Cost reconciliation arithmetic and validation tests passed");
