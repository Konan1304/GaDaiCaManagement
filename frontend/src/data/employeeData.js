export const products = [
  { id:1, name:"Gà rán giòn cay", price:45000, category:"Gà rán", image:"🍗" },
  { id:2, name:"Gà sốt Hàn Quốc", price:49000, category:"Gà rán", image:"🍗" },
  { id:3, name:"Cánh gà mật ong", price:52000, category:"Gà rán", image:"🍖" },
  { id:4, name:"Combo Đại Gà", price:129000, category:"Combo", image:"🍱" },
  { id:5, name:"Combo gia đình", price:259000, category:"Combo", image:"🍗" },
  { id:6, name:"Burger gà giòn", price:42000, category:"Burger", image:"🍔" },
  { id:7, name:"Khoai tây chiên", price:29000, category:"Ăn kèm", image:"🍟" },
  { id:8, name:"Salad bắp cải", price:25000, category:"Ăn kèm", image:"🥗" },
  { id:9, name:"Pepsi", price:15000, category:"Đồ uống", image:"🥤" },
  { id:10, name:"Trà đào", price:25000, category:"Đồ uống", image:"🧋" },
  { id:11, name:"7Up", price:15000, category:"Đồ uống", image:"🥤" },
  { id:12, name:"Kem vani", price:19000, category:"Tráng miệng", image:"🍦" },
];

export const initialOrders = [
  { id:"DG-1042", time:"10:42", total:174000, type:"Tại quầy", status:"Đơn mới", items:3 },
  { id:"DG-1041", time:"10:35", total:258000, type:"Mang đi", status:"Đang chuẩn bị", items:5 },
  { id:"DG-1040", time:"10:18", total:98000, type:"Giao hàng", status:"Hoàn thành", items:2 },
  { id:"DG-1039", time:"09:54", total:327000, type:"Giao hàng", status:"Đã giao", items:6 },
  { id:"DG-1038", time:"09:30", total:74000, type:"Tại quầy", status:"Đã hủy", items:2 },
  { id:"DG-1037", time:"09:12", total:189000, type:"Mang đi", status:"Hoàn thành", items:4 },
];

export const weeklySchedule = [
  ["Thứ 2","20/07","Ca sáng","07:00 - 12:00","morning"],
  ["Thứ 3","21/07","Ca chiều","12:00 - 17:00","afternoon"],
  ["Thứ 4","22/07","Ca sáng","07:00 - 12:00","morning"],
  ["Thứ 5","23/07","Ca tối","17:00 - 22:00","evening"],
  ["Thứ 6","24/07","Ca tối","17:00 - 22:00","evening"],
  ["Thứ 7","25/07","Ca chiều","12:00 - 17:00","afternoon"],
  ["Chủ nhật","26/07","Nghỉ","—","off"],
];

export const formatMoney = value => new Intl.NumberFormat("vi-VN").format(Number(value) || 0) + "đ";

export function readStorage(key, fallback) {
  try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; }
  catch { return fallback; }
}

export function writeStorage(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
