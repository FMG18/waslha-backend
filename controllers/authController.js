const User = require('../models/User');
const Captain = require('../models/Captain');
const { signToken } = require('../middleware/auth');

function fail(message, code='VALIDATION_ERROR', statusCode=400) { const e=new Error(message); e.statusCode=statusCode; e.code=code; return e; }
function normalizePhone(phone) { return String(phone||'').trim().replace(/[\s()-]/g,''); }
function normalizeVehicle(vehicle) {
  if (!vehicle) return null;
  if (!['taxi','motorcycle','delivery'].includes(vehicle.type)) throw fail('Invalid vehicle type','INVALID_VEHICLE_TYPE');
  const clean={type:vehicle.type,make:String(vehicle.make||'').trim().slice(0,80),model:String(vehicle.model||'').trim().slice(0,80),plateNumber:String(vehicle.plateNumber||'').trim().slice(0,30)};
  if(!clean.make||!clean.model||!clean.plateNumber) throw fail('Vehicle make, model and plate number are required','INVALID_VEHICLE');
  return clean;
}

async function register(req,res,next){
  try{
    const {name,password}=req.body; const phone=normalizePhone(req.body.phone);
    if(!name||name.trim().length<2||!phone||!password)throw fail('name, phone and password are required');
    if(password.length<8)throw fail('Password must be at least 8 characters');
    if(!/^\+?[1-9]\d{7,14}$/.test(phone))throw fail('Invalid phone number','INVALID_PHONE');
    const safeRole=req.body.role==='captain'?'captain':'customer';
    const vehicle=safeRole==='captain'?normalizeVehicle(req.body.vehicle):null;
    if(await User.exists({phone}))throw fail('Phone is already registered','PHONE_EXISTS',409);
    const user=await User.create({name:name.trim(),phone,password,role:safeRole});
    if(safeRole==='captain')await Captain.create({user:user._id,vehicle,documentsStatus:'pending'});
    return res.status(201).json({success:true,data:{user,token:signToken(user)}});
  }catch(err){next(err);}
}
async function login(req,res,next){
  try{
    const phone=normalizePhone(req.body.phone); const user=await User.findOne({phone}).select('+password');
    if(!user||!user.isActive||!(await user.comparePassword(req.body.password||'')))throw fail('Invalid phone or password','INVALID_CREDENTIALS',401);
    return res.json({success:true,data:{user,token:signToken(user)}});
  }catch(err){next(err);}
}
module.exports={register,login,normalizePhone};
