import { useRef } from "react";
import { FiCalendar } from "react-icons/fi";
import "../styles/vietnam-date-input.css";

const displayDate = value => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
};

export default function VietnamDateInput({ value, onChange, required = false, min, max, className = "", ...props }) {
  const inputRef = useRef(null);
  const openPicker = () => inputRef.current?.showPicker?.();
  const preventManualInput = event => {
    if (!["Tab", "Escape"].includes(event.key)) event.preventDefault();
  };

  return <span className={`vietnam-date-picker ${className}`.trim()}>
    <input
      className="vietnam-date-picker-native"
      ref={inputRef}
      type="date"
      value={value || ""}
      required={required}
      min={min}
      max={max}
      onClick={openPicker}
      onKeyDown={preventManualInput}
      onPaste={event => event.preventDefault()}
      onDrop={event => event.preventDefault()}
      onChange={onChange}
    />
    <input
      {...props}
      className="vietnam-date-picker-display"
      type="text"
      value={displayDate(value)}
      placeholder="dd/mm/yyyy"
      readOnly
      required={required}
      onClick={openPicker}
    />
    <button type="button" aria-label="Mở lịch chọn ngày" title="Chọn ngày" onClick={openPicker}>
      <FiCalendar />
    </button>
  </span>;
}
