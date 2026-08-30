const Captain = require('../models/Captain');
const Ride = require('../models/Ride');
const DEFAULT_RADIUS_KM = 5;
const MAX_CANDIDATES = 20;
const OFFER_TIMEOUT_MS = 15000;
function serviceToVehicleType(serviceType){ if(serviceType==='taxi')return'taxi'; if(serviceType==='motorcycle')return'motorcycle'; if(serviceType==='delivery')return'delivery'; return null; }
async function findNearbyCaptains({ride,radiusKm=DEFAULT_RADIUS_KM,limit=MAX_CANDIDATES}){
 const vehicleType=serviceToVehicleType(ride.serviceType); const [lng,lat]=ride.pickup.coordinates; const maxDistanceMeters=Math.max(500,Number(radiusKm)*1000);
 const filter={status:'active',availability:'online','currentLocation.coordinates':{$exists:true},...(vehicleType?{'vehicle.type':vehicleType}:{})};
 const excluded=(ride.matching?.offeredCaptains||[]).map(id=>id.toString()); if(excluded.length)filter._id={$nin:excluded};
 return Captain.find({...filter,currentLocation:{$near:{$geometry:{type:'Point',coordinates:[lng,lat]},$maxDistance:maxDistanceMeters}}}).limit(Math.min(Math.max(Number(limit)||MAX_CANDIDATES,1),MAX_CANDIDATES));
}
async function startMatching(rideId,options={}){ const ride=await Ride.findOneAndUpdate({_id:rideId,status:'requested',captain:null},{$set:{status:'searching'}},{new:true}); if(!ride){const e=new Error('Ride is not available for matching');e.statusCode=409;e.code='RIDE_NOT_MATCHABLE';throw e;} const candidates=await findNearbyCaptains({ride,...options}); return{ride,candidates}; }
async function offerNextCaptain(rideId,options={}){
 const ride=await Ride.findOne({_id:rideId,status:'searching',captain:null}); if(!ride)return null;
 const candidates=await findNearbyCaptains({ride,limit:1,...options}); const captain=candidates[0]; if(!captain)return null;
 const locked=await Captain.findOneAndUpdate({_id:captain._id,status:'active',availability:'online'},{$set:{availability:'busy'}},{new:true}); if(!locked)return offerNextCaptain(rideId,options);
 const claimed=await Ride.findOneAndUpdate({_id:rideId,status:'searching',captain:null},{$set:{'matching.currentCaptain':captain._id,'matching.offerExpiresAt':new Date(Date.now()+OFFER_TIMEOUT_MS)},$addToSet:{'matching.offeredCaptains':captain._id}},{new:true});
 if(!claimed){await Captain.updateOne({_id:captain._id,availability:'busy'},{$set:{availability:'online'}});return null;}
 return{ride:claimed,captain,expiresAt:claimed.matching.offerExpiresAt};
}
async function claimNextCaptain(rideId,captainId){
 const locked=await Captain.findOneAndUpdate({_id:captainId,status:'active',availability:'busy'},{$set:{availability:'busy'}},{new:true}); if(!locked)return null;
 const ride=await Ride.findOneAndUpdate({_id:rideId,status:'searching',captain:null,'matching.currentCaptain':captainId,'matching.offerExpiresAt':{$gt:new Date()}},{$set:{captain:captainId,status:'captain_assigned','matching.currentCaptain':null,'matching.offerExpiresAt':null}},{new:true});
 if(!ride){await Captain.updateOne({_id:captainId,availability:'busy'},{$set:{availability:'online'}});return null;} return ride;
}
async function rejectCaptain(rideId,captainId){const ride=await Ride.findOneAndUpdate({_id:rideId,status:'searching','matching.currentCaptain':captainId},{$set:{'matching.currentCaptain':null,'matching.offerExpiresAt':null}},{new:true});if(ride)await Captain.updateOne({_id:captainId,availability:'busy'},{$set:{availability:'online'}});return ride;}
module.exports={findNearbyCaptains,startMatching,offerNextCaptain,claimNextCaptain,rejectCaptain,serviceToVehicleType,OFFER_TIMEOUT_MS};
