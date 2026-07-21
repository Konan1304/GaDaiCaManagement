import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { FiAlertCircle, FiEye, FiEyeOff, FiLock, FiMail } from "react-icons/fi";
import hero from "../../assets/hero.png";
import { createSession, DEMO_USERS, getSession, homeForRole } from "../../utils/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const session = getSession();
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (session.isAuthenticated) return <Navigate to={homeForRole(session.role)} replace />;

  function handleSubmit(event) {
    event.preventDefault();
    const account = DEMO_USERS.find(item => item.email === email.trim().toLowerCase() && item.password === password);
    if (!account) { setError("Email hoặc mật khẩu không đúng"); return; }
    createSession(account);
    navigate(homeForRole(account.role), { replace: true });
  }

  return <div className="login-page"><section className="login-visual"><div className="visual-brand"><span className="brand-mark">ĐG</span><b>ĐẠI GÀ</b></div><div className="visual-copy"><span>Quản lý thông minh · Vận hành dễ dàng</span><h1>Món ngon trọn vị,<br/>quản lý trọn tâm.</h1><p>Một nền tảng duy nhất để quản lý nhân sự, kho hàng và doanh thu hiệu quả.</p></div><img src={hero} alt="Món gà rán Đại Gà"/></section><section className="login-panel"><form className="login-card" onSubmit={handleSubmit}><div className="login-logo"><span className="brand-mark">ĐG</span><div><b>ĐẠI GÀ</b><small>MANAGEMENT</small></div></div><div className="login-heading"><h2>Đăng nhập hệ thống</h2><p>Chào mừng bạn trở lại! Vui lòng nhập thông tin.</p></div>{error&&<div className="login-error"><FiAlertCircle/>{error}</div>}<label>Email<div className="input-wrap"><FiMail/><input type="email" placeholder="name@daiga.vn" value={email} onChange={e=>{setEmail(e.target.value);setError("")}} autoComplete="email" required/></div></label><label>Mật khẩu<div className="input-wrap"><FiLock/><input type={show?"text":"password"} placeholder="Nhập mật khẩu" value={password} onChange={e=>{setPassword(e.target.value);setError("")}} autoComplete="current-password" required/><button type="button" aria-label="Hiện hoặc ẩn mật khẩu" onClick={()=>setShow(!show)}>{show?<FiEyeOff/>:<FiEye/>}</button></div></label><div className="form-options"><label className="check"><input type="checkbox"/> Ghi nhớ đăng nhập</label><a href="#forgot">Quên mật khẩu?</a></div><button className="btn btn-primary btn-login" type="submit">Đăng nhập</button><div className="demo-accounts"><b>Tài khoản dùng thử</b><p>Quản lý: <button type="button" onClick={()=>{setEmail("admin@daiga.vn");setPassword("123456")}}>admin@daiga.vn / 123456</button></p><p>Nhân viên: <button type="button" onClick={()=>{setEmail("nhanvien@daiga.vn");setPassword("123456")}}>nhanvien@daiga.vn / 123456</button></p></div></form></section></div>;
}
