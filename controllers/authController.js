const User = require('../models/User');
const Captain = require('../models/Captain');
const { signToken } = require('../middleware/auth');

function fail(message, code='VALIDATION_ERROR', statusCode=400) { const e=new Error(message); e.statusCode=statusCode; e.code=code; return e; }
function normalizePhone(phone) { return String(phone||'').trim().replace(/[\s()-]/g,''); }

async function register(req,res,next){
  try{
    const {name,password}=req.body; const phone=normalizePhone(req.body.phone);
    if(!name||name.trim().length<2||!phone||!password)throw fail('name, phone and password are required');
    if(password.length<8)throw fail('Password must be at least 8 characters');
    if(!/^\+?[1-9]\d{7,14}$/.test(phone))throw fail('Invalid phone number','INVALID_PHONE');
    const safeRole=req.body.role==='captain'?'captain':'customer';
    if(await User.exists({phone}))throw fail('Phone is already registered','PHONE_EXISTS',409);
    const user=await User.create({name:name.trim(),phone,password,role:safeRole});
    if(safeRole==='captain')await Captain.create({user:user._id});
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
