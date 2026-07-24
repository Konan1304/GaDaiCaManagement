import {useState} from "react";
import {Navigate,useNavigate} from "react-router-dom";
import {FiAlertCircle,FiEye,FiEyeOff,FiLock,FiMail} from "react-icons/fi";
import hero from "../../assets/hero.png";
import {createSession,getSession,homeForRole} from "../../utils/auth";
import {authApi} from "../../api/services";

export default function LoginPage(){
 const navigate=useNavigate(),session=getSession();
 const [show,setShow]=useState(false),[email,setEmail]=useState(""),[password,setPassword]=useState("");
 const [error,setError]=useState(""),[loading,setLoading]=useState(false);
 if(session.isAuthenticated)return <Navigate to={homeForRole(session.role)} replace/>;
 async function handleSubmit(event){
  event.preventDefault();setLoading(true);setError("");
  try{const response=await authApi.login({email:email.trim().toLowerCase(),password});createSession(response);navigate(homeForRole(response.role),{replace:true})}
  catch(requestError){setError(requestError.response?.data?.message||"Không thể kết nối máy chủ")}
  finally{setLoading(false)}
 }
 return <div className="login-page">
  <section className="login-visual"><div className="visual-brand"><span className="brand-mark">GĐC</span><b>GÀ ĐẠI CA</b></div><div className="visual-copy"><span>Quản lý thông minh · Vận hành dễ dàng</span><h1>Món ngon trọn vị,<br/>quản lý trọn tâm.</h1><p>Một nền tảng duy nhất để quản lý nhân sự, kho hàng và doanh thu hiệu quả.</p></div><img src={hero} alt="Món gà rán Gà Đại Ca"/></section>
  <section className="login-panel"><form className="login-card" onSubmit={handleSubmit}><div className="login-logo"><span className="brand-mark">GĐC</span><div><b>GÀ ĐẠI CA</b><small>MANAGEMENT</small></div></div><div className="login-heading"><h2>Đăng nhập hệ thống</h2><p>Chào mừng bạn trở lại! Vui lòng nhập thông tin.</p></div>{error&&<div className="login-error"><FiAlertCircle/>{error}</div>}
   <label>Email<div className="input-wrap"><FiMail/><input type="email" placeholder="name@daiga.vn" value={email} onChange={event=>{setEmail(event.target.value);setError("")}} autoComplete="email" required/></div></label>
   <label>Mật khẩu<div className="input-wrap"><FiLock/><input type={show?"text":"password"} placeholder="Nhập mật khẩu" value={password} onChange={event=>{setPassword(event.target.value);setError("")}} autoComplete="current-password" required/><button type="button" aria-label="Hiện hoặc ẩn mật khẩu" onClick={()=>setShow(!show)}>{show?<FiEyeOff/>:<FiEye/>}</button></div></label>
   <div className="form-options"><label className="check"><input type="checkbox"/> Ghi nhớ đăng nhập</label><a href="#forgot">Quên mật khẩu?</a></div><button className="btn btn-primary btn-login" type="submit" disabled={loading}>{loading?"Đang đăng nhập...":"Đăng nhập"}</button>
  </form></section>
 </div>
}
