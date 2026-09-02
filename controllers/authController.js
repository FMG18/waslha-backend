const User = require('../models/User');
const Captain = require('../models/Captain');
const { signToken } = require('../middleware/auth');
const { env } = require('../config/env');

function fail(message, code='VALIDATION_ERROR', statusCode=400) { const e=new Error(message); e.statusCode=statusCode; e.code=code; return e; }
function normalizePhone(phone) { return String(phone||'').trim().replace(/[\s()-]/g,''); }

async function register(req,res,next){
  let user=null;
  try{
    const {name,password}=req.body; const phone=normalizePhone(req.body.phone);
    if(!name||name.trim().length<2||!phone||!password)throw fail('name, phone and password are required');
    if(password.length<8)throw fail('Password must be at least 8 characters');
    if(!/^\+?[1-9]\d{7,14}$/.test(phone))throw fail('Invalid phone number','INVALID_PHONE');
    const safeRole=req.body.role==='captain'?'captain':'customer';
    if(await User.exists({phone}))throw fail('Phone is already registered','PHONE_EXISTS',409);
    user=await User.create({name:name.trim(),phone,password,role:safeRole});
    if(safeRole==='captain'){
      try{
        const incoming=req.body.vehicle||{};
        await Captain.create({
          user:user._id,
          status:'pending',
          availability:'offline',
          vehicle:{
            type:['taxi','motorcycle','delivery'].includes(incoming.type)?incoming.type:'taxi',
            make:String(incoming.make||'').trim().slice(0,80),
            model:String(incoming.model||'').trim().slice(0,80),
            plateNumber:String(incoming.plateNumber||'').trim().slice(0,30)
          }
        });
      }catch(error){
        await User.deleteOne({_id:user._id}).catch(()=>{});
        throw error;
      }
    }
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

async function bootstrapAdmin(req,res,next){
  try{
    const key=String(req.get('x-admin-bootstrap-key')||'');
    if(!env.adminBootstrapKey||key.length===0||key!==env.adminBootstrapKey)throw fail('Invalid bootstrap key','INVALID_BOOTSTRAP_KEY',403);
    if(await User.exists({role:'admin'}))throw fail('An admin account already exists','ADMIN_ALREADY_EXISTS',409);
    const {name,password}=req.body||{}; const phone=normalizePhone(req.body?.phone);
    if(!name||name.trim().length<2||!phone||!password)throw fail('name, phone and password are required');
    if(password.length<8)throw fail('Password must be at least 8 characters');
    if(!/^\+?[1-9]\d{7,14}$/.test(phone))throw fail('Invalid phone number','INVALID_PHONE');
    if(await User.exists({phone}))throw fail('Phone is already registered','PHONE_EXISTS',409);
    const user=await User.create({name:name.trim(),phone,password,role:'admin'});
    return res.status(201).json({success:true,data:{user,token:signToken(user)}});
  }catch(err){next(err);}
}

module.exports={register,login,bootstrapAdmin,normalizePhone};
