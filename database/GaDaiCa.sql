/* =========================================================
   DATABASE: GaDaiCaManagement
   Hệ thống quản lý vận hành cửa hàng Gà Đại Ca
   ========================================================= */

USE master;
GO

IF DB_ID(N'GaDaiCaManagement') IS NULL
BEGIN
    CREATE DATABASE GaDaiCaManagement;
END
GO

USE GaDaiCaManagement;
GO

/* =========================================================
   1. ROLES - PHÂN QUYỀN
   ========================================================= */

CREATE TABLE roles (
    id INT IDENTITY(1,1) PRIMARY KEY,
    role_code VARCHAR(30) NOT NULL UNIQUE,
    role_name NVARCHAR(100) NOT NULL,
    description NVARCHAR(255),
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

/* =========================================================
   2. USERS - TÀI KHOẢN
   ========================================================= */

CREATE TABLE users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    role_id INT NOT NULL,
    full_name NVARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    avatar_url NVARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    last_login_at DATETIME2,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_users_roles
        FOREIGN KEY (role_id) REFERENCES roles(id),

    CONSTRAINT CK_users_status
        CHECK (status IN ('active', 'inactive', 'locked'))
);
GO

/* =========================================================
   3. BRANCHES - CHI NHÁNH
   ========================================================= */

CREATE TABLE branches (
    id INT IDENTITY(1,1) PRIMARY KEY,
    branch_code VARCHAR(30) NOT NULL UNIQUE,
    branch_name NVARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    address NVARCHAR(300),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT CK_branches_status
        CHECK (status IN ('active', 'inactive'))
);
GO

/* =========================================================
   4. POSITIONS - VỊ TRÍ NHÂN VIÊN
   ========================================================= */

CREATE TABLE positions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    position_code VARCHAR(30) NOT NULL UNIQUE,
    position_name NVARCHAR(100) NOT NULL,
    description NVARCHAR(255),
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

/* =========================================================
   5. EMPLOYEES - NHÂN VIÊN
   ========================================================= */

CREATE TABLE employees (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    branch_id INT NOT NULL,
    position_id INT NOT NULL,
    employee_code VARCHAR(30) NOT NULL UNIQUE,
    birth_date DATE,
    gender VARCHAR(10),
    address NVARCHAR(300),
    hire_date DATE NOT NULL,
    employment_type VARCHAR(20),
    base_salary DECIMAL(18,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'working',
    profile_update_locked BIT NOT NULL DEFAULT 0,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_employees_users
        FOREIGN KEY (user_id) REFERENCES users(id),

    CONSTRAINT FK_employees_branches
        FOREIGN KEY (branch_id) REFERENCES branches(id),

    CONSTRAINT FK_employees_positions
        FOREIGN KEY (position_id) REFERENCES positions(id),

    CONSTRAINT CK_employees_gender
        CHECK (gender IS NULL OR gender IN ('male', 'female', 'other')),

    CONSTRAINT CK_employees_status
        CHECK (status IN ('working', 'on_leave', 'resigned'))
);
GO

/* =========================================================
   6. SHIFTS - CA LÀM
   ========================================================= */

CREATE TABLE shifts (
    id INT IDENTITY(1,1) PRIMARY KEY,
    shift_code VARCHAR(30) NOT NULL UNIQUE,
    shift_name NVARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_minutes INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT CK_shifts_break_minutes
        CHECK (break_minutes >= 0),

    CONSTRAINT CK_shifts_status
        CHECK (status IN ('active', 'inactive'))
);
GO

/* =========================================================
   7. EMPLOYEE SCHEDULES - LỊCH LÀM VIỆC
   ========================================================= */

CREATE TABLE employee_schedules (
    id INT IDENTITY(1,1) PRIMARY KEY,
    employee_id INT NOT NULL,
    shift_id INT NOT NULL,
    branch_id INT NOT NULL,
    work_date DATE NOT NULL,
    work_position NVARCHAR(100),
    note NVARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    created_by INT,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_employee_schedules_employee
        FOREIGN KEY (employee_id) REFERENCES employees(id),

    CONSTRAINT FK_employee_schedules_shift
        FOREIGN KEY (shift_id) REFERENCES shifts(id),

    CONSTRAINT FK_employee_schedules_branch
        FOREIGN KEY (branch_id) REFERENCES branches(id),

    CONSTRAINT FK_employee_schedules_created_by
        FOREIGN KEY (created_by) REFERENCES users(id),

    CONSTRAINT UQ_employee_schedule
        UNIQUE (employee_id, shift_id, work_date),

    CONSTRAINT CK_employee_schedules_status
        CHECK (
            status IN (
                'scheduled',
                'working',
                'completed',
                'absent',
                'cancelled'
            )
        )
);
GO

/* =========================================================
   8. LEAVE REQUESTS - ĐƠN XIN NGHỈ
   ========================================================= */

CREATE TABLE leave_requests (
    id INT IDENTITY(1,1) PRIMARY KEY,
    employee_id INT NOT NULL,
    leave_date DATE NOT NULL,
    reason NVARCHAR(500) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    manager_note NVARCHAR(500),
    approved_by INT,
    approved_at DATETIME2,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_leave_requests_employee
        FOREIGN KEY (employee_id) REFERENCES employees(id),

    CONSTRAINT FK_leave_requests_approved_by
        FOREIGN KEY (approved_by) REFERENCES users(id),

    CONSTRAINT CK_leave_requests_status
        CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'))
);
GO

/* =========================================================
   9. ATTENDANCE DEVICES - MÁY CHẤM CÔNG
   ========================================================= */

CREATE TABLE attendance_devices (
    id INT IDENTITY(1,1) PRIMARY KEY,
    branch_id INT NOT NULL,
    device_code VARCHAR(50) NOT NULL UNIQUE,
    device_name NVARCHAR(150) NOT NULL,
    device_model NVARCHAR(100),
    ip_address VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    last_sync_at DATETIME2,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_attendance_devices_branch
        FOREIGN KEY (branch_id) REFERENCES branches(id),

    CONSTRAINT CK_attendance_devices_status
        CHECK (status IN ('active', 'inactive', 'offline'))
);
GO

/* =========================================================
   10. ATTENDANCE LOGS - LỊCH SỬ CHẤM CÔNG
   Không lưu dữ liệu vân tay trong database này.
   Chỉ lưu mã nhân viên và thời gian do máy gửi về.
   ========================================================= */

CREATE TABLE attendance_logs (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    employee_id INT NOT NULL,
    device_id INT,
    schedule_id INT,
    attendance_type VARCHAR(20) NOT NULL,
    attendance_time DATETIME2 NOT NULL,
    source VARCHAR(30) NOT NULL DEFAULT 'device',
    note NVARCHAR(255),
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_attendance_logs_employee
        FOREIGN KEY (employee_id) REFERENCES employees(id),

    CONSTRAINT FK_attendance_logs_device
        FOREIGN KEY (device_id) REFERENCES attendance_devices(id),

    CONSTRAINT FK_attendance_logs_schedule
        FOREIGN KEY (schedule_id) REFERENCES employee_schedules(id),

    CONSTRAINT CK_attendance_logs_type
        CHECK (attendance_type IN ('check_in', 'check_out')),

    CONSTRAINT CK_attendance_logs_source
        CHECK (source IN ('device', 'manual', 'system'))
);
GO

/* =========================================================
   11. CATEGORIES - DANH MỤC
   ========================================================= */

CREATE TABLE categories (
    id INT IDENTITY(1,1) PRIMARY KEY,
    category_code VARCHAR(30) NOT NULL UNIQUE,
    category_name NVARCHAR(150) NOT NULL,
    category_type VARCHAR(30) NOT NULL DEFAULT 'sale',
    description NVARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT CK_categories_type
        CHECK (category_type IN ('sale', 'ingredient', 'packaging', 'other')),

    CONSTRAINT CK_categories_status
        CHECK (status IN ('active', 'inactive'))
);
GO

/* =========================================================
   12. UNITS - ĐƠN VỊ TÍNH
   ========================================================= */

CREATE TABLE units (
    id INT IDENTITY(1,1) PRIMARY KEY,
    unit_code VARCHAR(30) NOT NULL UNIQUE,
    unit_name NVARCHAR(100) NOT NULL
);
GO

/* =========================================================
   13. PRODUCTS - SẢN PHẨM / NGUYÊN LIỆU
   ========================================================= */

CREATE TABLE products (
    id INT IDENTITY(1,1) PRIMARY KEY,
    category_id INT NOT NULL,
    unit_id INT NOT NULL,
    product_code VARCHAR(50) NOT NULL UNIQUE,
    product_name NVARCHAR(200) NOT NULL,
    product_type VARCHAR(30) NOT NULL,
    sale_price DECIMAL(18,2) NOT NULL DEFAULT 0,
    cost_price DECIMAL(18,2) NOT NULL DEFAULT 0,
    minimum_stock DECIMAL(18,3) NOT NULL DEFAULT 0,
    image_url NVARCHAR(500),
    description NVARCHAR(1000),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_products_category
        FOREIGN KEY (category_id) REFERENCES categories(id),

    CONSTRAINT FK_products_unit
        FOREIGN KEY (unit_id) REFERENCES units(id),

    CONSTRAINT CK_products_type
        CHECK (product_type IN ('sale_item', 'ingredient', 'packaging')),

    CONSTRAINT CK_products_sale_price
        CHECK (sale_price >= 0),

    CONSTRAINT CK_products_cost_price
        CHECK (cost_price >= 0),

    CONSTRAINT CK_products_minimum_stock
        CHECK (minimum_stock >= 0),

    CONSTRAINT CK_products_status
        CHECK (status IN ('active', 'inactive', 'out_of_stock'))
);
GO

/* =========================================================
   14. BRANCH INVENTORIES - TỒN KHO TỪNG CHI NHÁNH
   ========================================================= */

CREATE TABLE branch_inventories (
    id INT IDENTITY(1,1) PRIMARY KEY,
    branch_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity DECIMAL(18,3) NOT NULL DEFAULT 0,
    average_cost DECIMAL(18,2) NOT NULL DEFAULT 0,
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_branch_inventories_branch
        FOREIGN KEY (branch_id) REFERENCES branches(id),

    CONSTRAINT FK_branch_inventories_product
        FOREIGN KEY (product_id) REFERENCES products(id),

    CONSTRAINT UQ_branch_inventory
        UNIQUE (branch_id, product_id),

    CONSTRAINT CK_branch_inventory_quantity
        CHECK (quantity >= 0),

    CONSTRAINT CK_branch_inventory_average_cost
        CHECK (average_cost >= 0)
);
GO

/* =========================================================
   15. SUPPLIERS - NHÀ CUNG CẤP
   ========================================================= */

CREATE TABLE suppliers (
    id INT IDENTITY(1,1) PRIMARY KEY,
    supplier_code VARCHAR(30) NOT NULL UNIQUE,
    supplier_name NVARCHAR(200) NOT NULL,
    contact_name NVARCHAR(150),
    phone VARCHAR(20),
    email VARCHAR(150),
    address NVARCHAR(300),
    tax_code VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT CK_suppliers_status
        CHECK (status IN ('active', 'inactive'))
);
GO

/* =========================================================
   16. PURCHASE RECEIPTS - PHIẾU NHẬP
   ========================================================= */

CREATE TABLE purchase_receipts (
    id INT IDENTITY(1,1) PRIMARY KEY,
    receipt_code VARCHAR(50) NOT NULL UNIQUE,
    branch_id INT NOT NULL,
    supplier_id INT NOT NULL,
    created_by INT NOT NULL,
    receipt_date DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    total_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    note NVARCHAR(500),
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_purchase_receipts_branch
        FOREIGN KEY (branch_id) REFERENCES branches(id),

    CONSTRAINT FK_purchase_receipts_supplier
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id),

    CONSTRAINT FK_purchase_receipts_created_by
        FOREIGN KEY (created_by) REFERENCES users(id),

    CONSTRAINT CK_purchase_receipts_total
        CHECK (total_amount >= 0),

    CONSTRAINT CK_purchase_receipts_status
        CHECK (status IN ('draft', 'receiving', 'completed', 'cancelled'))
);
GO

/* =========================================================
   17. PURCHASE RECEIPT ITEMS - CHI TIẾT PHIẾU NHẬP
   ========================================================= */

CREATE TABLE purchase_receipt_items (
    id INT IDENTITY(1,1) PRIMARY KEY,
    purchase_receipt_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity DECIMAL(18,3) NOT NULL,
    unit_price DECIMAL(18,2) NOT NULL,
    line_total AS (quantity * unit_price) PERSISTED,

    CONSTRAINT FK_purchase_receipt_items_receipt
        FOREIGN KEY (purchase_receipt_id)
        REFERENCES purchase_receipts(id)
        ON DELETE CASCADE,

    CONSTRAINT FK_purchase_receipt_items_product
        FOREIGN KEY (product_id) REFERENCES products(id),

    CONSTRAINT CK_purchase_receipt_items_quantity
        CHECK (quantity > 0),

    CONSTRAINT CK_purchase_receipt_items_unit_price
        CHECK (unit_price >= 0),

    CONSTRAINT UQ_purchase_receipt_product
        UNIQUE (purchase_receipt_id, product_id)
);
GO

/* =========================================================
   18. INVENTORY TRANSACTIONS - LỊCH SỬ NHẬP/XUẤT KHO
   ========================================================= */

CREATE TABLE inventory_transactions (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    branch_id INT NOT NULL,
    product_id INT NOT NULL,
    transaction_type VARCHAR(30) NOT NULL,
    quantity DECIMAL(18,3) NOT NULL,
    unit_cost DECIMAL(18,2) NOT NULL DEFAULT 0,
    reference_type VARCHAR(50),
    reference_id INT,
    reason NVARCHAR(500),
    created_by INT,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_inventory_transactions_branch
        FOREIGN KEY (branch_id) REFERENCES branches(id),

    CONSTRAINT FK_inventory_transactions_product
        FOREIGN KEY (product_id) REFERENCES products(id),

    CONSTRAINT FK_inventory_transactions_created_by
        FOREIGN KEY (created_by) REFERENCES users(id),

    CONSTRAINT CK_inventory_transactions_type
        CHECK (
            transaction_type IN (
                'import',
                'sale',
                'waste',
                'adjustment_in',
                'adjustment_out',
                'transfer_in',
                'transfer_out'
            )
        ),

    CONSTRAINT CK_inventory_transactions_quantity
        CHECK (quantity > 0),

    CONSTRAINT CK_inventory_transactions_unit_cost
        CHECK (unit_cost >= 0)
);
GO

/* =========================================================
   19. SHIFT SESSIONS - PHIÊN MỞ CA / ĐÓNG CA
   ========================================================= */

CREATE TABLE shift_sessions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    branch_id INT NOT NULL,
    employee_id INT NOT NULL,
    schedule_id INT,
    shift_id INT NOT NULL,
    business_date DATE NOT NULL,
    opened_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    closed_at DATETIME2,
    opening_cash DECIMAL(18,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    note NVARCHAR(500),
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_shift_sessions_branch
        FOREIGN KEY (branch_id) REFERENCES branches(id),

    CONSTRAINT FK_shift_sessions_employee
        FOREIGN KEY (employee_id) REFERENCES employees(id),

    CONSTRAINT FK_shift_sessions_schedule
        FOREIGN KEY (schedule_id) REFERENCES employee_schedules(id),

    CONSTRAINT FK_shift_sessions_shift
        FOREIGN KEY (shift_id) REFERENCES shifts(id),

    CONSTRAINT CK_shift_sessions_opening_cash
        CHECK (opening_cash >= 0),

    CONSTRAINT CK_shift_sessions_status
        CHECK (status IN ('open', 'closed', 'cancelled'))
);
GO

/* Chỉ cho một nhân viên có một ca đang mở tại một thời điểm */

CREATE UNIQUE INDEX UX_shift_sessions_employee_open
ON shift_sessions(employee_id)
WHERE status = 'open';
GO

/* =========================================================
   20. ORDERS - ĐƠN HÀNG POS
   ========================================================= */

CREATE TABLE orders (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    order_code VARCHAR(50) NOT NULL UNIQUE,
    branch_id INT NOT NULL,
    employee_id INT NOT NULL,
    shift_session_id INT,
    order_source VARCHAR(30) NOT NULL DEFAULT 'counter',
    order_type VARCHAR(30) NOT NULL DEFAULT 'takeaway',
    customer_name NVARCHAR(150),
    customer_phone VARCHAR(20),
    subtotal DECIMAL(18,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'new',
    note NVARCHAR(500),
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    completed_at DATETIME2,
    cancelled_at DATETIME2,

    CONSTRAINT FK_orders_branch
        FOREIGN KEY (branch_id) REFERENCES branches(id),

    CONSTRAINT FK_orders_employee
        FOREIGN KEY (employee_id) REFERENCES employees(id),

    CONSTRAINT FK_orders_shift_session
        FOREIGN KEY (shift_session_id) REFERENCES shift_sessions(id),

    CONSTRAINT CK_orders_source
        CHECK (
            order_source IN (
                'counter',
                'phone',
                'grab',
                'shopeefood',
                'be',
                'other'
            )
        ),

    CONSTRAINT CK_orders_type
        CHECK (order_type IN ('dine_in', 'takeaway', 'delivery')),

    CONSTRAINT CK_orders_status
        CHECK (
            status IN (
                'new',
                'confirmed',
                'preparing',
                'ready',
                'completed',
                'delivered',
                'cancelled'
            )
        ),

    CONSTRAINT CK_orders_subtotal
        CHECK (subtotal >= 0),

    CONSTRAINT CK_orders_discount
        CHECK (discount_amount >= 0),

    CONSTRAINT CK_orders_total
        CHECK (total_amount >= 0)
);
GO

/* =========================================================
   21. ORDER ITEMS - CHI TIẾT ĐƠN HÀNG
   ========================================================= */

CREATE TABLE order_items (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    order_id BIGINT NOT NULL,
    product_id INT NOT NULL,
    product_name NVARCHAR(200) NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(18,2) NOT NULL,
    discount_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    line_total AS (
        quantity * unit_price - discount_amount
    ) PERSISTED,
    note NVARCHAR(300),

    CONSTRAINT FK_order_items_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE CASCADE,

    CONSTRAINT FK_order_items_product
        FOREIGN KEY (product_id) REFERENCES products(id),

    CONSTRAINT CK_order_items_quantity
        CHECK (quantity > 0),

    CONSTRAINT CK_order_items_unit_price
        CHECK (unit_price >= 0),

    CONSTRAINT CK_order_items_discount
        CHECK (discount_amount >= 0)
);
GO

/* =========================================================
   22. PAYMENTS - THANH TOÁN
   Một đơn có thể thanh toán nhiều phương thức.
   ========================================================= */

CREATE TABLE payments (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    order_id BIGINT NOT NULL,
    payment_method VARCHAR(30) NOT NULL,
    amount DECIMAL(18,2) NOT NULL,
    transaction_code VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    paid_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_payments_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE CASCADE,

    CONSTRAINT CK_payments_method
        CHECK (
            payment_method IN (
                'cash',
                'bank_transfer',
                'momo',
                'zalopay',
                'grab',
                'shopeefood',
                'other'
            )
        ),

    CONSTRAINT CK_payments_amount
        CHECK (amount > 0),

    CONSTRAINT CK_payments_status
        CHECK (status IN ('pending', 'completed', 'failed', 'refunded'))
);
GO

/* =========================================================
   23. EXPENSE CATEGORIES - LOẠI CHI PHÍ
   ========================================================= */

CREATE TABLE expense_categories (
    id INT IDENTITY(1,1) PRIMARY KEY,
    category_code VARCHAR(30) NOT NULL UNIQUE,
    category_name NVARCHAR(150) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',

    CONSTRAINT CK_expense_categories_status
        CHECK (status IN ('active', 'inactive'))
);
GO

/* =========================================================
   24. SHIFT EXPENSES - CHI PHÍ PHÁT SINH TRONG CA
   ========================================================= */

CREATE TABLE shift_expenses (
    id INT IDENTITY(1,1) PRIMARY KEY,
    shift_session_id INT NOT NULL,
    expense_category_id INT NOT NULL,
    employee_id INT NOT NULL,
    expense_date DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    amount DECIMAL(18,2) NOT NULL,
    title NVARCHAR(200) NOT NULL,
    note NVARCHAR(1000),
    receipt_image_url NVARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'submitted',
    approved_by INT,
    approved_at DATETIME2,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_shift_expenses_shift_session
        FOREIGN KEY (shift_session_id) REFERENCES shift_sessions(id),

    CONSTRAINT FK_shift_expenses_category
        FOREIGN KEY (expense_category_id) REFERENCES expense_categories(id),

    CONSTRAINT FK_shift_expenses_employee
        FOREIGN KEY (employee_id) REFERENCES employees(id),

    CONSTRAINT FK_shift_expenses_approved_by
        FOREIGN KEY (approved_by) REFERENCES users(id),

    CONSTRAINT CK_shift_expenses_amount
        CHECK (amount > 0),

    CONSTRAINT CK_shift_expenses_status
        CHECK (status IN ('submitted', 'approved', 'rejected'))
);
GO

/* =========================================================
   25. SHIFT CLOSING REPORTS - BÁO CÁO ĐÓNG CA
   ========================================================= */

CREATE TABLE shift_closing_reports (
    id INT IDENTITY(1,1) PRIMARY KEY,
    shift_session_id INT NOT NULL UNIQUE,
    employee_id INT NOT NULL,
    business_date DATE NOT NULL,

    opening_cash DECIMAL(18,2) NOT NULL DEFAULT 0,

    cash_revenue DECIMAL(18,2) NOT NULL DEFAULT 0,
    transfer_revenue DECIMAL(18,2) NOT NULL DEFAULT 0,
    ewallet_revenue DECIMAL(18,2) NOT NULL DEFAULT 0,
    delivery_revenue DECIMAL(18,2) NOT NULL DEFAULT 0,

    total_revenue DECIMAL(18,2) NOT NULL DEFAULT 0,
    total_expense DECIMAL(18,2) NOT NULL DEFAULT 0,

    expected_cash DECIMAL(18,2) NOT NULL DEFAULT 0,
    actual_cash DECIMAL(18,2) NOT NULL DEFAULT 0,
    difference_amount DECIMAL(18,2) NOT NULL DEFAULT 0,

    note NVARCHAR(1000),
    status VARCHAR(20) NOT NULL DEFAULT 'submitted',
    closed_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    reviewed_by INT,
    reviewed_at DATETIME2,
    manager_note NVARCHAR(1000),

    CONSTRAINT FK_shift_closing_reports_session
        FOREIGN KEY (shift_session_id) REFERENCES shift_sessions(id),

    CONSTRAINT FK_shift_closing_reports_employee
        FOREIGN KEY (employee_id) REFERENCES employees(id),

    CONSTRAINT FK_shift_closing_reports_reviewed_by
        FOREIGN KEY (reviewed_by) REFERENCES users(id),

    CONSTRAINT CK_shift_closing_reports_status
        CHECK (status IN ('submitted', 'approved', 'rejected', 'adjusted'))
);
GO

/* =========================================================
   26. NOTIFICATIONS - THÔNG BÁO
   ========================================================= */

CREATE TABLE notifications (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    title NVARCHAR(200) NOT NULL,
    content NVARCHAR(1000) NOT NULL,
    reference_type VARCHAR(50),
    reference_id BIGINT,
    is_read BIT NOT NULL DEFAULT 0,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_notifications_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
);
GO

/* =========================================================
   27. SYSTEM SETTINGS - CÀI ĐẶT
   ========================================================= */

CREATE TABLE system_settings (
    id INT IDENTITY(1,1) PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value NVARCHAR(MAX),
    description NVARCHAR(500),
    updated_by INT,
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_system_settings_updated_by
        FOREIGN KEY (updated_by) REFERENCES users(id)
);
GO

/* =========================================================
   INDEXES
   ========================================================= */

CREATE INDEX IX_users_role_id
ON users(role_id);
GO

CREATE INDEX IX_employees_branch_id
ON employees(branch_id);
GO

CREATE INDEX IX_employee_schedules_work_date
ON employee_schedules(work_date);
GO

CREATE INDEX IX_employee_schedules_employee_date
ON employee_schedules(employee_id, work_date);
GO

CREATE INDEX IX_attendance_logs_employee_time
ON attendance_logs(employee_id, attendance_time);
GO

CREATE INDEX IX_inventory_transactions_product_date
ON inventory_transactions(product_id, created_at);
GO

CREATE INDEX IX_orders_created_at
ON orders(created_at);
GO

CREATE INDEX IX_orders_branch_status
ON orders(branch_id, status);
GO

CREATE INDEX IX_orders_shift_session
ON orders(shift_session_id);
GO

CREATE INDEX IX_notifications_user_read
ON notifications(user_id, is_read);
GO

CREATE INDEX IX_shift_expenses_session
ON shift_expenses(shift_session_id);
GO

/* =========================================================
   DỮ LIỆU MẪU BAN ĐẦU
   ========================================================= */

INSERT INTO roles (role_code, role_name, description)
VALUES
('admin', N'Quản trị viên', N'Toàn quyền quản lý hệ thống'),
('manager', N'Quản lý cửa hàng', N'Quản lý nhân viên, kho và báo cáo'),
('employee', N'Nhân viên', N'Xem lịch, bán hàng, mở ca và đóng ca');
GO

INSERT INTO branches (
    branch_code,
    branch_name,
    phone,
    address
)
VALUES (
    'CN001',
    N'Gà Đại Ca - Chi nhánh chính',
    '0900000000',
    N'Thành phố Hồ Chí Minh'
);
GO

INSERT INTO positions (position_code, position_name)
VALUES
('MANAGER', N'Quản lý/Giám sát'),
('CASHIER', N'Nhân viên thu ngân'),
('KITCHEN', N'Nhân viên bếp'),
('COUNTER', N'Nhân viên quầy');
GO

INSERT INTO shifts (
    shift_code,
    shift_name,
    start_time,
    end_time,
    break_minutes
)
VALUES
('MORNING', N'Ca sáng', '07:00', '15:00', 30),
('AFTERNOON', N'Ca chiều', '15:00', '22:00', 30),
('EVENING', N'Ca tối', '17:00', '23:00', 30);
GO

INSERT INTO units (unit_code, unit_name)
VALUES
('PIECE', N'Phần'),
('KG', N'Kilogram'),
('GRAM', N'Gram'),
('LITER', N'Lít'),
('BOTTLE', N'Chai'),
('CAN', N'Lon'),
('BOX', N'Hộp'),
('BAG', N'Bao');
GO

INSERT INTO categories (
    category_code,
    category_name,
    category_type
)
VALUES
('FRIED_CHICKEN', N'Gà rán', 'sale'),
('COMBO', N'Combo', 'sale'),
('DRINK', N'Nước uống', 'sale'),
('SIDE_DISH', N'Món ăn kèm', 'sale'),
('INGREDIENT', N'Nguyên liệu', 'ingredient'),
('PACKAGING', N'Bao bì', 'packaging');
GO

INSERT INTO expense_categories (
    category_code,
    category_name
)
VALUES
('VEGETABLE', N'Mua rau'),
('RICE', N'Mua gạo'),
('INGREDIENT', N'Mua nguyên liệu'),
('TRANSPORT', N'Vận chuyển'),
('REPAIR', N'Sửa chữa'),
('OTHER', N'Khác');
GO

INSERT INTO suppliers (
    supplier_code,
    supplier_name,
    contact_name,
    phone,
    address
)
VALUES
(
    'NCC001',
    N'Công ty Thực phẩm Gà Đại Ca',
    N'Nguyễn Văn Nhà Cung Cấp',
    '0911111111',
    N'Thành phố Hồ Chí Minh'
);
GO

/* =========================================================
   SẢN PHẨM MẪU
   ========================================================= */

DECLARE @CategoryGa INT =
(
    SELECT id
    FROM categories
    WHERE category_code = 'FRIED_CHICKEN'
);

DECLARE @CategoryDrink INT =
(
    SELECT id
    FROM categories
    WHERE category_code = 'DRINK'
);

DECLARE @CategorySide INT =
(
    SELECT id
    FROM categories
    WHERE category_code = 'SIDE_DISH'
);

DECLARE @UnitPiece INT =
(
    SELECT id
    FROM units
    WHERE unit_code = 'PIECE'
);

DECLARE @UnitCan INT =
(
    SELECT id
    FROM units
    WHERE unit_code = 'CAN'
);

INSERT INTO products (
    category_id,
    unit_id,
    product_code,
    product_name,
    product_type,
    sale_price,
    cost_price,
    minimum_stock
)
VALUES
(
    @CategoryGa,
    @UnitPiece,
    'GA_TRUYEN_THONG',
    N'Gà rán truyền thống',
    'sale_item',
    35000,
    22000,
    10
),
(
    @CategoryGa,
    @UnitPiece,
    'GA_SOT_CAY',
    N'Gà sốt cay',
    'sale_item',
    40000,
    25000,
    10
),
(
    @CategorySide,
    @UnitPiece,
    'KHOAI_TAY',
    N'Khoai tây chiên',
    'sale_item',
    25000,
    12000,
    10
),
(
    @CategoryDrink,
    @UnitCan,
    'PEPSI',
    N'Pepsi',
    'sale_item',
    15000,
    8000,
    20
);
GO

PRINT N'Tạo database GaDaiCaManagement thành công.';
GO
