const mongoose = require('mongoose');
const Ride = require('../models/Ride');
const Captain = require('../models/Captain');
const { success } = require('../utils/response');
const { startMatching, claimNextCaptain } = require('../services/matchingService');
function fail(message, code, statusCode = 400) { const error = new Error(message); error.code = code; error.statusCode = statusCode; return error; }
async function begin(req,res,next){try{if(!mongoose.isValidObjectId(req.params.id))throw fail('Ride not found','RIDE_NOT_FOUND',404);const ride=await Ride.findById(req.params.id);if(!ride)throw fail('Ride not found','RIDE_NOT_FOUND',404);if(!ride.customer.equals(req.user._id)&&req.user.role!=='admin')throw fail('Forbidden','FORBIDDEN',403);const result=await startMatching(ride._id);return success(res,{ride:result.ride,candidatesCount:result.candidates.length});}catch(e){next(e);}}
async function claim(req,res,next){try{const captain=await Captain.findOne({user:req.user._id,status:'active',availability:'busy'});if(!captain)throw fail('Captain has no active offer','CAPTAIN_NOT_AVAILABLE',409);if(!mongoose.isValidObjectId(req.params.id))throw fail('Ride not found','RIDE_NOT_FOUND',404);const ride=await claimNextCaptain(req.params.id,captain._id);if(!ride)throw fail('Ride is no longer available','RIDE_UNAVAILABLE',409);return success(res,ride);}catch(e){next(e);}}
module.exports={begin,claim};
