import {useEffect,useRef,useState} from 'react';
import {Navigate,useNavigate} from 'react-router-dom';
import {FiAlertCircle,FiEye,FiEyeOff,FiLock,FiMail} from 'react-icons/fi';
import {createSession,getSession,homeForRole} from '../../utils/auth';
import {authApi} from '../../api/services';

export default function LoginPage(){
 const navigate=useNavigate(),session=getSession();
 const [show,setShow]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [error,setError]=useState(''),[loading,setLoading]=useState(false),[showWelcome,setShowWelcome]=useState(false),[forgot,setForgot]=useState(false),[forgotMessage,setForgotMessage]=useState('');
 const welcomeTimer=useRef(null);useEffect(()=>()=>clearTimeout(welcomeTimer.current),[]);
 if(showWelcome)return <div className="employee-login-welcome" role="status"><div className="employee-login-welcome-logo"><img src="/admin-avatar.png" alt="Logo Gà Đại Ca"/></div><h1>Gà Đại Ca</h1><p>Chào mừng bạn trở lại</p><span className="employee-login-welcome-loader"/></div>;
 if(session.isAuthenticated)return <Navigate to={homeForRole(session.role)} replace/>;
 async function handleSubmit(event){event.preventDefault();setLoading(true);setError('');try{const response=await authApi.login({email:email.trim().toLowerCase(),password});createSession(response);if(response.role==='employee'){setShowWelcome(true);welcomeTimer.current=setTimeout(()=>navigate('/employee/home',{replace:true}),1500)}else navigate(homeForRole(response.role),{replace:true})}catch(e){setError(e.response?.data?.message||'Không thể kết nối máy chủ')}finally{setLoading(false)}}
 async function handleForgot(){setLoading(true);setError('');setForgotMessage('');try{const result=await authApi.forgotPassword(email.trim().toLowerCase());setForgotMessage(result.message)}catch(e){setError(e.response?.data?.message||'Không thể gửi yêu cầu')}finally{setLoading(false)}}
 return <div className="login-page"><section className="login-visual"><div className="login-brand-name"><img src="/admin-avatar.png" alt="Logo Gà Đại Ca"/><div><b>GÀ ĐẠI CA</b><small>CHIKIN DAEJANG</small></div></div><div className="visual-copy"><span>Hệ thống quản lý cửa hàng</span><h1>Vận hành dễ dàng,<br/>quản lý hiệu quả.</h1><p>Quản lý nhân sự, lịch làm việc, kho hàng và doanh thu trên cùng một nền tảng.</p><div className="login-feature-list"><span>Nhân sự</span><span>Kho hàng</span><span>Doanh thu</span></div></div><img className="login-chicken-logo" src="/admin-avatar.png" alt="Gà Đại Ca"/></section>
 <section className="login-panel"><form className="login-card" onSubmit={handleSubmit}><div className="login-logo"><img src="/admin-avatar.png" alt="Logo Gà Đại Ca"/><div><b>GÀ ĐẠI CA</b><small>CHIKIN DAEJANG</small></div></div><div className="login-heading"><span>GÀ ĐẠI CA - CHIKIN DAEJANG</span><h2>Đăng nhập hệ thống</h2><p>Nhập tài khoản được cấp để tiếp tục làm việc.</p></div>{error&&<div className="login-error"><FiAlertCircle/>{error}</div>}
 <label>Email<div className="input-wrap"><FiMail/><input type="email" placeholder="abc@gdc.vn" value={email} onChange={e=>{setEmail(e.target.value);setError('')}} autoComplete="email" required/></div></label>
 <label>Mật khẩu<div className="input-wrap"><FiLock/><input type={show?'text':'password'} placeholder="Nhập mật khẩu" value={password} onChange={e=>{setPassword(e.target.value);setError('')}} autoComplete="current-password" required={!forgot}/><button type="button" aria-label="Hiện hoặc ẩn mật khẩu" onClick={()=>setShow(!show)}>{show?<FiEyeOff/>:<FiEye/>}</button></div></label>
 <div className="form-options"><label className="check"><input type="checkbox"/> Ghi nhớ đăng nhập</label><button type="button" className="login-forgot-link" onClick={()=>{setForgot(!forgot);setError('');setForgotMessage('')}}>Quên mật khẩu?</button></div>
 {forgot&&<div className="forgot-password-box"><p>Nhập email ở trên. Quản trị viên sẽ nhận thông báo và cấp mật khẩu mới cho bạn.</p>{forgotMessage&&<div className="manager-form-success">{forgotMessage}</div>}<button type="button" className="btn btn-light" disabled={loading||!email.trim()} onClick={handleForgot}>Gửi yêu cầu đặt lại mật khẩu</button></div>}
 <button className="btn btn-primary btn-login" type="submit" disabled={loading}>{loading?'Đang xử lý...':'Đăng nhập'}</button></form></section></div>;
}
