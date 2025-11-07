// تعریف نام دیتابیس و نسخه
const DB_NAME = 'ReceiptManagerDB';
const DB_VERSION = 1;

// ایجاد یا باز کردن دیتابیس
let db;

// توابع تاریخ شمسی
const persianDate = {
    // دریافت تاریخ امروز به شمسی
    getToday: function() {
        const today = new Date();
        return this.toPersian(today);
    },
    
    // تبدیل میلادی به شمسی
    toPersian: function(date) {
        if (!date) return '';
        
        if (typeof date === 'string' && date.includes('/')) {
            return date; // اگر قبلاً شمسی است
        }
        
        // استفاده از کتابخانه تاریخ شمسی
        if (window.PersianDate) {
            const pDate = new PersianDate(date);
            return pDate.format('YYYY/MM/DD');
        }
        
        // fallback ساده
        const today = new Date(date);
        const year = (today.getFullYear() - 621).toString();
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        
        return this.toPersianDigits(`${year}/${month}/${day}`);
    },
    
    // تبدیل اعداد انگلیسی به فارسی
    toPersianDigits: function(num) {
        const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
        return num.toString().replace(/\d/g, function(d) {
            return persianDigits[parseInt(d)];
        });
    },
    
    // تبدیل اعداد فارسی به انگلیسی
    toEnglishDigits: function(num) {
        const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
        return num.toString().replace(/[۰-۹]/g, function(d) {
            return persianDigits.indexOf(d);
        });
    }
};

// مقداردهی اولیه برنامه
document.addEventListener('DOMContentLoaded', function() {
    initDB();
    setupEventListeners();
    loadAgents();
    updateStats();
    loadRecentReceipts();
});

// راه‌اندازی دیتابیس
function initDB() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = function(event) {
        console.error('خطا در باز کردن دیتابیس:', event.target.error);
        showNotification('خطا در بارگذاری دیتابیس', 'error');
    };
    
    request.onsuccess = function(event) {
        db = event.target.result;
        console.log('دیتابیس با موفقیت بارگذاری شد');
        
        // بارگذاری نمایندگان در فرم ثبت رسید
        populateAgentSelect();
    };
    
    request.onupgradeneeded = function(event) {
        const db = event.target.result;
        
        // ایجاد استور برای نمایندگان
        if (!db.objectStoreNames.contains('agents')) {
            const agentStore = db.createObjectStore('agents', { keyPath: 'id', autoIncrement: true });
            agentStore.createIndex('name', 'name', { unique: false });
        }
        
        // ایجاد استور برای رسیدها
        if (!db.objectStoreNames.contains('receipts')) {
            const receiptStore = db.createObjectStore('receipts', { keyPath: 'id', autoIncrement: true });
            receiptStore.createIndex('agentId', 'agentId', { unique: false });
            receiptStore.createIndex('date', 'date', { unique: false });
        }
    };
}
// تنظیم رویدادها
function setupEventListeners() {
    // تب‌ها
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            switchTab(tabId);
        });
    });
    
    // فرم نماینده
    document.getElementById('agentForm').addEventListener('submit', saveAgent);
    document.getElementById('receiptDate').value = persianDate.getToday();
    
    // فرم رسید
    document.getElementById('receiptForm').addEventListener('submit', saveReceipt);
    
    // دکمه افزودن نماینده
    document.getElementById('addAgentBtn').addEventListener('click', function() {
        openAgentModal();
    });
    
    setupExportFunctions();
    
    // دکمه جستجو
    document.getElementById('searchBtn').addEventListener('click', searchReceipts);
    
    // پیش‌نمایش تصویر
    document.getElementById('receiptImage').addEventListener('change', previewImage);
    document.getElementById('clearAllBtn').addEventListener('click', clearAllData);
    
    // پشتیبان‌گیری و بازیابی
    document.getElementById('backupBtn').addEventListener('click', backupData);
    document.getElementById('restoreBtn').addEventListener('click', function() {
        document.getElementById('restoreFile').click();
    });
    document.getElementById('restoreFile').addEventListener('change', restoreData);
    
    // مودال‌ها
    document.querySelectorAll('.close-modal').forEach(button => {
        button.addEventListener('click', function() {
            closeModals();
        });
    });
    
    // کلیک خارج از مودال
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            closeModals();
        }
    });
    
    // راه‌اندازی تقویم‌ها با تاخیر برای اطمینان از لود کامل کتابخانه‌ها
    setTimeout(() => {
        initializeDatepickers();
    }, 100);
}
// تغییر تب
function switchTab(tabId) {
    // غیرفعال کردن همه تب‌ها
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // فعال کردن تب انتخاب شده
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(tabId).classList.add('active');
    
    // بارگذاری داده‌های مورد نیاز برای تب
    if (tabId === 'agents') {
        loadAgents();
    } else if (tabId === 'search') {
        // بارگذاری آخرین جستجو
    } else if (tabId === 'reports') {
        updateStats();
        loadRecentReceipts();
    }
}

// بارگذاری نمایندگان
function loadAgents() {
    if (!db) return;
    
    const transaction = db.transaction(['agents'], 'readonly');
    const store = transaction.objectStore('agents');
    const request = store.getAll();
    
    request.onsuccess = function() {
        const agents = request.result;
        displayAgents(agents);
        populateAgentSelect(agents);
    };
    
    request.onerror = function() {
        console.error('خطا در بارگذاری نمایندگان');
        showNotification('خطا در بارگذاری نمایندگان', 'error');
    };
}
function displayAgents(agents) {
    const agentsList = document.getElementById('agentsList');
    
    if (agents.length === 0) {
        agentsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <h3>هیچ نماینده‌ای ثبت نشده است</h3>
                <p>برای افزودن نماینده جدید روی دکمه "افزودن نماینده" کلیک کنید</p>
            </div>
        `;
        return;
    }
    
    agentsList.innerHTML = '';
    
    agents.forEach(agent => {
        const agentCard = document.createElement('div');
        agentCard.className = 'agent-card';
        agentCard.innerHTML = `
            <div class="agent-header">
                <div class="agent-info-main">
                    <div class="agent-name">${agent.name}</div>
                    <div class="agent-phone">
                        <i class="fas fa-phone"></i>
                        ${agent.phone}
                    </div>
                </div>
                <div class="agent-actions">
                    <button class="btn edit-agent" data-id="${agent.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn view-agent" data-id="${agent.id}">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn delete-agent" data-id="${agent.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="agent-details">
                <p><strong><i class="fas fa-map-marker-alt"></i> آدرس:</strong> ${agent.address || 'ثبت نشده'}</p>
                <p><strong><i class="fas fa-sticky-note"></i> یادداشت:</strong> ${agent.notes || 'ثبت نشده'}</p>
            </div>
        `;
        
        agentsList.appendChild(agentCard);
    });
    
    // اضافه کردن رویدادها به دکمه‌ها
    document.querySelectorAll('.edit-agent').forEach(button => {
        button.addEventListener('click', function() {
            const agentId = parseInt(this.getAttribute('data-id'));
            openAgentModal(agentId);
        });
    });
    
    document.querySelectorAll('.view-agent').forEach(button => {
        button.addEventListener('click', function() {
            const agentId = parseInt(this.getAttribute('data-id'));
            viewAgentDetails(agentId);
        });
    });
    
    document.querySelectorAll('.delete-agent').forEach(button => {
        button.addEventListener('click', function() {
            const agentId = parseInt(this.getAttribute('data-id'));
            deleteAgent(agentId);
        });
    });
}
// فعال کردن تقویم شمسی - نسخه اصلاح شده
function initializeDatepickers() {
    console.log('Initializing datepickers...');
    
    // بررسی وجود jQuery
    if (typeof jQuery === 'undefined') {
        console.error('jQuery is not loaded');
        showNotification('خطا در بارگذاری کتابخانه‌ها', 'error');
        return;
    }
    
    // بررسی وجود PersianDatepicker
    if (typeof $.fn.persianDatepicker === 'undefined') {
        console.error('PersianDatepicker is not loaded');
        return;
    }
    
    try {
        // تقویم برای تاریخ رسید
        $('#receiptDate').persianDatepicker({
            format: 'YYYY/MM/DD',
            initialValue: true,
            initialValueType: 'persian',
            autoClose: true,
            position: 'auto',
            observer: true,
            calendar: {
                persian: {
                    locale: 'fa',
                    showHint: true
                }
            },
            toolbox: {
                calendarSwitch: {
                    enabled: false
                }
            },
            navigator: {
                scroll: {
                    enabled: true
                }
            },
            timePicker: {
                enabled: false
            }
        });
        
        // تقویم برای جستجو
        $('#searchDate').persianDatepicker({
            format: 'YYYY/MM/DD',
            initialValue: false,
            initialValueType: 'persian',
            autoClose: true,
            position: 'auto',
            observer: true,
            calendar: {
                persian: {
                    locale: 'fa',
                    showHint: true
                }
            },
            toolbox: {
                calendarSwitch: {
                    enabled: false
                }
            },
            navigator: {
                scroll: {
                    enabled: true
                }
            },
            timePicker: {
                enabled: false
            }
        });
        
        console.log('Datepickers initialized successfully');
    } catch (error) {
        console.error('Error initializing datepickers:', error);
       
    }
}

// در تابع setupEventListeners این خط را اضافه کن:
initializeDatepickers();
// پر کردن لیست انتخاب نماینده
function populateAgentSelect(agents) {
    const agentSelect = document.getElementById('agentSelect');
    
    // اگر لیست نمایندگان ارسال نشده، از دیتابیس بخواه
    if (!agents) {
        if (!db) return;
        
        const transaction = db.transaction(['agents'], 'readonly');
        const store = transaction.objectStore('agents');
        const request = store.getAll();
        
        request.onsuccess = function() {
            agents = request.result;
            updateAgentSelect(agents);
        };
        
        return;
    }
    
    updateAgentSelect(agents);
}

function updateAgentSelect(agents) {
    const agentSelect = document.getElementById('agentSelect');
    
    // حذف همه گزینه‌ها به جز اولین گزینه
    while (agentSelect.children.length > 1) {
        agentSelect.removeChild(agentSelect.lastChild);
    }
    
    // اضافه کردن نمایندگان به لیست
    agents.forEach(agent => {
        const option = document.createElement('option');
        option.value = agent.id;
        option.textContent = agent.name;
        agentSelect.appendChild(option);
    });
}

// باز کردن مودال نماینده
function openAgentModal(agentId = null) {
    const modal = document.getElementById('agentModal');
    const title = document.getElementById('agentModalTitle');
    const form = document.getElementById('agentForm');
    
    if (agentId) {
        // حالت ویرایش
        title.textContent = 'ویرایش نماینده';
        loadAgentData(agentId);
    } else {
        // حالت افزودن
        title.textContent = 'افزودن نماینده جدید';
        form.reset();
        document.getElementById('agentId').value = '';
    }
    
    modal.classList.add('active');
}

// بستن مودال‌ها
function closeModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
}

// بارگذاری داده‌های نماینده برای ویرایش
function loadAgentData(agentId) {
    if (!db) return;
    
    const transaction = db.transaction(['agents'], 'readonly');
    const store = transaction.objectStore('agents');
    const request = store.get(agentId);
    
    request.onsuccess = function() {
        const agent = request.result;
        if (agent) {
            document.getElementById('agentId').value = agent.id;
            document.getElementById('agentName').value = agent.name;
            document.getElementById('agentPhone').value = agent.phone;
            document.getElementById('agentAddress').value = agent.address || '';
            document.getElementById('agentNotes').value = agent.notes || '';
        }
    };
}

// ذخیره نماینده
function saveAgent(event) {
    event.preventDefault();
    
    const agentId = document.getElementById('agentId').value;
    const name = document.getElementById('agentName').value.trim();
    const phone = document.getElementById('agentPhone').value.trim();
    const address = document.getElementById('agentAddress').value.trim();
    const notes = document.getElementById('agentNotes').value.trim();
    
    if (!name || !phone) {
        showNotification('لطفاً نام و شماره تماس را وارد کنید', 'warning');
        return;
    }
    
    const agent = {
        name,
        phone,
        address,
        notes,
        createdAt: new Date()
    };
    
    if (agentId) {
        agent.id = parseInt(agentId);
    }
    
    if (!db) {
        showNotification('خطا در اتصال به دیتابیس', 'error');
        return;
    }
    
    const transaction = db.transaction(['agents'], 'readwrite');
    const store = transaction.objectStore('agents');
    const request = agentId ? store.put(agent) : store.add(agent);
    
    request.onsuccess = function() {
        showNotification(agentId ? 'نماینده با موفقیت ویرایش شد' : 'نماینده با موفقیت افزوده شد', 'success');
        closeModals();
        loadAgents();
        populateAgentSelect();
    };
    
    request.onerror = function() {
        showNotification('خطا در ذخیره نماینده', 'error');
    };
}

// حذف نماینده
function deleteAgent(agentId) {
    if (!confirm('آیا از حذف این نماینده اطمینان دارید؟')) {
        return;
    }
    
    if (!db) return;
    
    // ابتدا بررسی کنیم که آیا رسیدی برای این نماینده وجود دارد
    const transaction = db.transaction(['receipts'], 'readonly');
    const receiptStore = transaction.objectStore('receipts');
    const index = receiptStore.index('agentId');
    const request = index.getAll(agentId);
    
    request.onsuccess = function() {
        const receipts = request.result;
        
        if (receipts.length > 0) {
            if (!confirm(`این نماینده ${receipts.length} رسید دارد. آیا باز هم می‌خواهید حذف شود؟`)) {
                return;
            }
        }
        
        // حذف نماینده
        const agentTransaction = db.transaction(['agents'], 'readwrite');
        const agentStore = agentTransaction.objectStore('agents');
        const deleteRequest = agentStore.delete(agentId);
        
        deleteRequest.onsuccess = function() {
            showNotification('نماینده با موفقیت حذف شد', 'success');
            loadAgents();
            populateAgentSelect();
        };
        
        deleteRequest.onerror = function() {
            showNotification('خطا در حذف نماینده', 'error');
        };
    };
}

function deleteReceipt(receiptId, agentId = null) {
    if (!confirm('آیا از حذف این رسید اطمینان دارید؟')) {
        return;
    }
    
    if (!db) return;
    
    const transaction = db.transaction(['receipts'], 'readwrite');
    const store = transaction.objectStore('receipts');
    const request = store.delete(receiptId);
    
    request.onsuccess = function() {
        showNotification('رسید با موفقیت حذف شد', 'success');
        
        // به روزرسانی آمار
        updateStats();
        loadRecentReceipts();
        
        // اگر از داخل پروفایل نماینده حذف شد، پروفایل را به روز کن
        if (agentId) {
            viewAgentDetails(agentId);
        }
        
        // اگر در تب جستجو هستیم، نتایج را به روز کن
        if (document.getElementById('search').classList.contains('active')) {
            searchReceipts();
        }
    };
    
    request.onerror = function() {
        showNotification('خطا در حذف رسید', 'error');
    };
}
function viewAgentDetails(agentId) {
    if (!db) return;
    
    const transaction = db.transaction(['agents', 'receipts'], 'readonly');
    const agentStore = transaction.objectStore('agents');
    const receiptStore = transaction.objectStore('receipts');
    const index = receiptStore.index('agentId');
    
    const agentRequest = agentStore.get(agentId);
    const receiptsRequest = index.getAll(agentId);
    
    agentRequest.onsuccess = function() {
        const agent = agentRequest.result;
        
        receiptsRequest.onsuccess = function() {
            const receipts = receiptsRequest.result;
            displayAgentDetails(agent, receipts);
        };
    };
}
// متغیر global برای ذخیره اطلاعات نماینده فعلی
let currentAgentData = null;
let currentAgentReceipts = null;

// تنظیم توابع خروجی برای نماینده - نسخه اصلاح شده
function setupAgentExportFunctions() {
    console.log('Setting up agent export functions...');
    
    // حذف event listenerهای قبلی
    document.querySelectorAll('#agentDetailsModal .export-option').forEach(button => {
        button.replaceWith(button.cloneNode(true));
    });
    
    // اضافه کردن event listenerهای جدید
    document.querySelectorAll('#agentDetailsModal .export-option').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const exportType = this.getAttribute('data-type');
            console.log('Export type clicked:', exportType);
            
            try {
                handleAgentExport(exportType);
            } catch (error) {
                console.error('Error in agent export:', error);
                showNotification('خطا در ایجاد خروجی', 'error');
            }
            
            // بستن منوی dropdown بعد از کلیک
            const dropdown = this.closest('.export-menu');
            if (dropdown) {
                dropdown.style.display = 'none';
            }
        });
    });
    
    // فعال کردن dropdown منو
    const exportBtn = document.querySelector('#agentDetailsModal #agentExportBtn');
    const exportMenu = document.querySelector('#agentDetailsModal .export-menu');
    
    if (exportBtn && exportMenu) {
        exportBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            exportMenu.style.display = exportMenu.style.display === 'block' ? 'none' : 'block';
        });
        
        // بستن منو وقتی کلیک خارج شود
        document.addEventListener('click', function() {
            exportMenu.style.display = 'none';
        });
        
        exportMenu.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }
    
    console.log('Agent export functions setup completed');
}

// مدیریت خروجی‌های نماینده
function handleAgentExport(type) {
    if (!currentAgentData || !currentAgentReceipts) {
        showNotification('داده‌های نماینده در دسترس نیست', 'error');
        return;
    }
    
    switch(type) {
        case 'agent-print':
            printAgentProfile();
            break;
        case 'agent-excel':
            exportAgentToExcel();
            break;
        case 'agent-pdf':
            exportAgentToPDF();
            break;
        case 'agent-receipts-print':
            printAgentReceipts();
            break;
    }
}
// چاپ پروفایل کامل نماینده - نسخه اصلاح شده با تصاویر
function printAgentProfile() {
    const printWindow = window.open('', '_blank');
    const currentDate = persianDate.getToday();
    const totalAmount = currentAgentReceipts.reduce((sum, receipt) => sum + receipt.amount, 0);
    const avgAmount = currentAgentReceipts.length > 0 ? Math.round(totalAmount / currentAgentReceipts.length) : 0;
    
    const printContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="fa">
        <head>
            <meta charset="UTF-8">
            <title>پروفایل نماینده - ${currentAgentData.name}</title>
            <style>
                body { 
                    font-family: 'Vazirmatn', Tahoma, sans-serif; 
                    margin: 20px; 
                    color: #333;
                    background: white;
                }
                .agent-print-header { 
                    text-align: center; 
                    border-bottom: 3px solid #4361ee; 
                    padding-bottom: 20px; 
                    margin-bottom: 25px;
                }
                .agent-print-info { 
                    display: grid; 
                    grid-template-columns: 1fr 1fr; 
                    gap: 20px; 
                    margin-bottom: 25px; 
                    background: #f8f9fa; 
                    padding: 20px; 
                    border-radius: 10px;
                }
                .agent-print-stats { 
                    display: grid; 
                    grid-template-columns: repeat(3, 1fr); 
                    gap: 15px; 
                    margin-bottom: 25px;
                }
                .agent-print-stat { 
                    text-align: center; 
                    padding: 15px; 
                    background: white; 
                    border-radius: 8px; 
                    border-right: 4px solid #4361ee; 
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                }
                .receipt-print-item { 
                    border: 1px solid #ddd; 
                    padding: 20px; 
                    margin-bottom: 25px; 
                    border-radius: 8px; 
                    border-right: 3px solid #28a745;
                    page-break-inside: avoid;
                }
                .receipt-print-header { 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center; 
                    margin-bottom: 15px; 
                    padding-bottom: 15px; 
                    border-bottom: 1px dashed #ddd;
                }
                .receipt-print-image { 
                    margin-top: 15px; 
                    text-align: center;
                }
                .receipt-print-image img { 
                    max-width: 300px; 
                    max-height: 200px; 
                    border: 1px solid #ddd; 
                    border-radius: 5px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                .image-caption {
                    margin-top: 8px;
                    font-size: 12px;
                    color: #666;
                }
                .no-image {
                    text-align: center;
                    color: #999;
                    font-style: italic;
                    padding: 20px;
                    background: #f8f9fa;
                    border-radius: 5px;
                }
                @media print {
                    body { margin: 10px; }
                    .agent-print-stats { grid-template-columns: repeat(3, 1fr); }
                    .receipt-print-item { page-break-inside: avoid; }
                    .receipt-print-image img { max-width: 250px; }
                }
            </style>
        </head>
        <body>
            <div class="agent-print-header">
                <h1>پروفایل نماینده</h1>
                <h2 style="color: #4361ee; margin: 10px 0;">${currentAgentData.name}</h2>
                <p>تاریخ تهیه گزارش: ${currentDate}</p>
            </div>
            
            <div class="agent-print-info">
                <div>
                    <h3>اطلاعات تماس</h3>
                    <p><strong>شماره تماس:</strong> ${currentAgentData.phone}</p>
                    ${currentAgentData.address ? `<p><strong>آدرس:</strong> ${currentAgentData.address}</p>` : ''}
                    ${currentAgentData.notes ? `<p><strong>یادداشت:</strong> ${currentAgentData.notes}</p>` : ''}
                </div>
                <div>
                    <h3>تاریخچه فعالیت</h3>
                    <p><strong>تعداد رسیدها:</strong> ${currentAgentReceipts.length}</p>
                    <p><strong>مجموع مبالغ:</strong> ${formatCurrency(totalAmount)} دالر</p>
                    <p><strong>میانگین مبلغ:</strong> ${formatCurrency(avgAmount)} دالر</p>
                </div>
            </div>
            
            <div class="agent-print-stats">
                <div class="agent-print-stat">
                    <h3>${currentAgentReceipts.length}</h3>
                    <p>تعداد رسیدها</p>
                </div>
                <div class="agent-print-stat">
                    <h3>${formatCurrency(totalAmount)}</h3>
                    <p>مجموع مبالغ</p>
                </div>
                <div class="agent-print-stat">
                    <h3>${formatCurrency(avgAmount)}</h3>
                    <p>میانگین مبلغ</p>
                </div>
            </div>
            
            <div class="agent-print-receipts">
                <h2 style="border-bottom: 2px solid #4361ee; padding-bottom: 10px; margin-bottom: 20px;">لیست رسیدها</h2>
                
                ${currentAgentReceipts.map((receipt, index) => `
                    <div class="receipt-print-item">
                        <div class="receipt-print-header">
                            <div>
                                <strong style="font-size: 18px;">رسید شماره ${index + 1}</strong>
                                <br>
                                <span style="color: #666; margin-top: 5px; display: block;">
                                    <i class="fas fa-calendar"></i>
                                    تاریخ: ${persianDate.toPersianDigits(receipt.date)}
                                </span>
                            </div>
                            <div style="color: #28a745; font-weight: bold; font-size: 20px;">
                                ${formatCurrency(receipt.amount)} دالر
                            </div>
                        </div>
                        
                        <div class="receipt-print-details">
                            <p style="margin: 10px 0;"><strong>شرح:</strong> ${receipt.description}</p>
                            <p style="margin: 10px 0; color: #666; font-size: 14px;">
                                <i class="fas fa-clock"></i>
                                ثبت شده در: ${new Date(receipt.createdAt).toLocaleString('fa-IR')}
                            </p>
                        </div>
                        
                        ${receipt.image ? `
                        <div class="receipt-print-image">
                            <p style="margin-bottom: 10px; font-weight: bold;">
                                <i class="fas fa-image"></i>
                                تصویر رسید:
                            </p>
                            <img src="${receipt.image}" alt="تصویر رسید ${currentAgentData.name}">
                            <div class="image-caption">
                                تصویر رسید شماره ${index + 1} - ${persianDate.toPersianDigits(receipt.date)}
                            </div>
                        </div>
                        ` : `
                        <div class="no-image">
                            <i class="fas fa-image" style="font-size: 24px; margin-bottom: 10px;"></i>
                            <div>این رسید فاقد تصویر می‌باشد</div>
                        </div>
                        `}
                    </div>
                `).join('')}
            </div>
            
            <div style="margin-top: 30px; text-align: center; color: #6c757d; font-size: 0.9rem; border-top: 1px solid #ddd; padding-top: 15px;">
                <p>تهیه شده توسط سیستم مدیریت رسیدها - Receipt Manager Pro</p>
                <p>تعداد کل صفحات: <span id="pageCount"></span></p>
            </div>

            <script>
                // شمارش صفحات بعد از لود
                window.addEventListener('load', function() {
                    setTimeout(function() {
                        const pageCount = Math.ceil(document.body.scrollHeight / window.innerHeight);
                        document.getElementById('pageCount').textContent = pageCount;
                    }, 500);
                });
            </script>
        </body>
        </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
        printWindow.print();
    }, 1000);
}

// خروجی Excel برای نماینده
function exportAgentToExcel() {
    let excelData = "ردیف\tتاریخ رسید\tشرح رسید\tمبلغ (دالر)\tتاریخ ثبت\n";
    
    currentAgentReceipts.forEach((receipt, index) => {
        excelData += `${index + 1}\t`;
        excelData += `${persianDate.toPersianDigits(receipt.date)}\t`;
        excelData += `${receipt.description}\t`;
        excelData += `${receipt.amount}\t`;
        excelData += `${new Date(receipt.createdAt).toLocaleString('fa-IR')}\n`;
    });
    
    // اضافه کردن خلاصه
    const totalAmount = currentAgentReceipts.reduce((sum, receipt) => sum + receipt.amount, 0);
    excelData += `\n\nخلاصه:\n`;
    excelData += `نام نماینده:\t${currentAgentData.name}\n`;
    excelData += `تعداد رسیدها:\t${currentAgentReceipts.length}\n`;
    excelData += `مجموع مبالغ:\t${totalAmount} دالر\n`;
    
    const blob = new Blob([excelData], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent_${currentAgentData.name}_receipts_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('خروجی Excel با موفقیت ایجاد شد', 'success');
}
// خروجی PDF برای نماینده - نسخه پیشرفته با تصاویر
function exportAgentToPDF() {
    if (typeof jsPDF === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = function() {
            generateAgentPDFWithImages();
        };
        document.head.appendChild(script);
        showNotification('در حال بارگیری کتابخانه PDF...', 'info');
    } else {
        generateAgentPDFWithImages();
    }
    
    function generateAgentPDFWithImages() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const totalAmount = currentAgentReceipts.reduce((sum, receipt) => sum + receipt.amount, 0);
        const avgAmount = currentAgentReceipts.length > 0 ? Math.round(totalAmount / currentAgentReceipts.length) : 0;
        
        // هدر
        doc.setFont('tahoma');
        doc.setFontSize(20);
        doc.setTextColor(67, 97, 238);
        doc.text('پروفایل نماینده', 105, 15, null, null, 'center');
        
        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        doc.text(`نام: ${currentAgentData.name}`, 20, 30);
        doc.text(`شماره تماس: ${currentAgentData.phone}`, 20, 40);
        
        if (currentAgentData.address) {
            doc.text(`آدرس: ${currentAgentData.address}`, 20, 50);
        }
        
        // آمار
        let yPosition = 70;
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text('آمار کلی:', 20, yPosition);
        yPosition += 10;
        
        doc.setFontSize(12);
        doc.text(`تعداد رسیدها: ${currentAgentReceipts.length}`, 30, yPosition);
        yPosition += 8;
        doc.text(`مجموع مبالغ: ${formatCurrency(totalAmount)} دالر`, 30, yPosition);
        yPosition += 8;
        doc.text(`میانگین مبلغ: ${formatCurrency(avgAmount)} دالر`, 30, yPosition);
        yPosition += 20;
        
        // لیست رسیدها
        doc.setFontSize(16);
        doc.text('لیست رسیدها:', 20, yPosition);
        yPosition += 15;
        
        currentAgentReceipts.forEach((receipt, index) => {
            // بررسی اگر صفحه پر شده، صفحه جدید ایجاد کن
            if (yPosition > 250) {
                doc.addPage();
                yPosition = 20;
            }
            
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.text(`رسید شماره ${index + 1}`, 25, yPosition);
            yPosition += 7;
            
            doc.setFontSize(10);
            doc.text(`تاریخ: ${persianDate.toPersianDigits(receipt.date)}`, 30, yPosition);
            yPosition += 5;
            doc.text(`مبلغ: ${formatCurrency(receipt.amount)} دالر`, 30, yPosition);
            yPosition += 5;
            
            // اگر شرح طولانی است، آن را تقسیم کن
            const description = receipt.description.length > 80 ? 
                receipt.description.substring(0, 77) + '...' : receipt.description;
            doc.text(`شرح: ${description}`, 30, yPosition);
            yPosition += 8;
            
            // اضافه کردن تصویر اگر وجود دارد
            if (receipt.image) {
                try {
                    // اضافه کردن متن "تصویر رسید"
                    doc.text('تصویر رسید:', 30, yPosition);
                    yPosition += 5;
                    
                    // اضافه کردن تصویر (با اندازه کوچک‌تر برای PDF)
                    const img = new Image();
                    img.src = receipt.image;
                    
                    // منتظر بمان تا تصویر لود شود
                    img.onload = function() {
                        const imgWidth = 80;
                        const imgHeight = (img.height * imgWidth) / img.width;
                        
                        if (yPosition + imgHeight > 270) {
                            doc.addPage();
                            yPosition = 20;
                        }
                        
                        doc.addImage(receipt.image, 'JPEG', 30, yPosition, imgWidth, imgHeight);
                        yPosition += imgHeight + 10;
                    };
                    
                    // برای سادگی، فعلاً بدون تصویر ادامه می‌دهیم
                    doc.text('(تصویر در نسخه کامل موجود است)', 35, yPosition);
                    yPosition += 8;
                    
                } catch (error) {
                    console.error('Error adding image to PDF:', error);
                    doc.text('(خطا در نمایش تصویر)', 35, yPosition);
                    yPosition += 8;
                }
            } else {
                doc.text('(بدون تصویر)', 35, yPosition);
                yPosition += 8;
            }
            
            doc.setTextColor(100, 100, 100);
            doc.text(`تاریخ ثبت: ${new Date(receipt.createdAt).toLocaleDateString('fa-IR')}`, 30, yPosition);
            yPosition += 15;
            
            // خط جداکننده
            if (index < currentAgentReceipts.length - 1) {
                doc.setDrawColor(200, 200, 200);
                doc.line(20, yPosition, 190, yPosition);
                yPosition += 10;
            }
        });
        
        doc.save(`agent_${currentAgentData.name}_report_${new Date().toISOString().split('T')[0]}.pdf`);
        showNotification('خروجی PDF با موفقیت ایجاد شد', 'success');
    }
}
// چاپ فقط رسیدهای نماینده - نسخه اصلاح شده با تصاویر
function printAgentReceipts() {
    const printWindow = window.open('', '_blank');
    const currentDate = persianDate.getToday();
    
    const printContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="fa">
        <head>
            <meta charset="UTF-8">
            <title>رسیدهای نماینده - ${currentAgentData.name}</title>
            <style>
                body { 
                    font-family: 'Vazirmatn', Tahoma, sans-serif; 
                    margin: 20px; 
                    color: #333;
                    background: white;
                }
                .receipts-header { 
                    text-align: center; 
                    border-bottom: 2px solid #4361ee; 
                    padding-bottom: 15px; 
                    margin-bottom: 20px; 
                }
                .receipt-item { 
                    border: 1px solid #ddd; 
                    padding: 20px; 
                    margin-bottom: 20px; 
                    border-radius: 8px; 
                    border-right: 3px solid #28a745; 
                    page-break-inside: avoid;
                }
                .receipt-image { 
                    margin-top: 15px; 
                    text-align: center;
                }
                .receipt-image img { 
                    max-width: 250px; 
                    max-height: 180px; 
                    border: 1px solid #ddd; 
                    border-radius: 5px;
                }
                .no-image {
                    text-align: center;
                    color: #999;
                    font-style: italic;
                    padding: 15px;
                    background: #f8f9fa;
                    border-radius: 5px;
                    margin-top: 10px;
                }
                @media print { 
                    body { margin: 10px; } 
                    .receipt-item { page-break-inside: avoid; }
                    .receipt-image img { max-width: 200px; }
                }
            </style>
        </head>
        <body>
            <div class="receipts-header">
                <h1>رسیدهای نماینده</h1>
                <h2 style="color: #4361ee;">${currentAgentData.name}</h2>
                <p>تاریخ چاپ: ${currentDate}</p>
                <p>تعداد رسیدها: ${currentAgentReceipts.length}</p>
            </div>
            
            ${currentAgentReceipts.map((receipt, index) => `
                <div class="receipt-item">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px dashed #ddd;">
                        <div>
                            <strong style="font-size: 16px; display: block; margin-bottom: 5px;">رسید شماره ${index + 1}</strong>
                            <div style="color: #666; font-size: 14px;">
                                <i class="fas fa-calendar"></i>
                                تاریخ: ${persianDate.toPersianDigits(receipt.date)}
                            </div>
                        </div>
                        <div style="color: #28a745; font-weight: bold; font-size: 18px;">
                            ${formatCurrency(receipt.amount)} دالر
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <strong>شرح:</strong> 
                        <div style="margin-top: 5px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                            ${receipt.description}
                        </div>
                    </div>
                    
                    ${receipt.image ? `
                    <div class="receipt-image">
                        <strong style="display: block; margin-bottom: 10px;">تصویر رسید:</strong>
                        <img src="${receipt.image}" alt="تصویر رسید ${currentAgentData.name}">
                        <div style="margin-top: 5px; font-size: 12px; color: #666;">
                            تصویر پیوست رسید شماره ${index + 1}
                        </div>
                    </div>
                    ` : `
                    <div class="no-image">
                        <i class="fas fa-image"></i>
                        <span>این رسید فاقد تصویر می‌باشد</span>
                    </div>
                    `}
                    
                    <div style="margin-top: 15px; color: #666; font-size: 12px; border-top: 1px dashed #ddd; padding-top: 10px;">
                        <i class="fas fa-clock"></i>
                        ثبت شده در: ${new Date(receipt.createdAt).toLocaleString('fa-IR')}
                    </div>
                </div>
            `).join('')}
            
            <div style="margin-top: 30px; text-align: center; color: #6c757d; font-size: 0.9rem; border-top: 1px solid #ddd; padding-top: 15px;">
                <p>تهیه شده توسط سیستم مدیریت رسیدها - Receipt Manager Pro</p>
            </div>
        </body>
        </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
        printWindow.print();
    }, 1000);
}
// نمایش جزئیات نماینده - نسخه اصلاح شده
function displayAgentDetails(agent, receipts) {
    const modal = document.getElementById('agentDetailsModal');
    const title = document.getElementById('agentDetailsTitle');
    const content = document.getElementById('agentDetailsContent');
    
    // ذخیره داده‌ها برای استفاده در خروجی - این خط حیاتی است!
    currentAgentData = agent;
    currentAgentReceipts = receipts;
    
    title.textContent = `پروفایل ${agent.name}`;
    
    // محاسبه مجموع مبالغ
    const totalAmount = receipts.reduce((sum, receipt) => sum + receipt.amount, 0);
    const avgAmount = receipts.length > 0 ? Math.round(totalAmount / receipts.length) : 0;
    
    let html = `
        <div class="agent-profile-header">
            <div class="agent-avatar">
                <i class="fas fa-user-tie"></i>
            </div>
            <div class="agent-info">
                <h3>${agent.name}</h3>
                <p><i class="fas fa-phone"></i> ${agent.phone}</p>
                ${agent.address ? `<p><i class="fas fa-map-marker-alt"></i> ${agent.address}</p>` : ''}
                ${agent.notes ? `<p><i class="fas fa-sticky-note"></i> ${agent.notes}</p>` : ''}
            </div>
        </div>
        
        <div class="agent-stats">
            <div class="agent-stat-card">
                <div class="stat-icon">
                    <i class="fas fa-receipt"></i>
                </div>
                <div class="stat-info">
                    <h4>${receipts.length}</h4>
                    <p>تعداد رسید</p>
                </div>
            </div>
            <div class="agent-stat-card">
                <div class="stat-icon">
                    <i class="fas fa-money-bill-wave"></i>
                </div>
                <div class="stat-info">
                    <h4>${formatCurrency(totalAmount)}</h4>
                    <p>مجموع مبالغ</p>
                </div>
            </div>
            <div class="agent-stat-card">
                <div class="stat-icon">
                    <i class="fas fa-calculator"></i>
                </div>
                <div class="stat-info">
                    <h4>${formatCurrency(avgAmount)}</h4>
                    <p>میانگین مبلغ</p>
                </div>
            </div>
        </div>
        
        <div class="agent-receipts-section">
            <div class="section-header">
                <h3><i class="fas fa-receipt"></i> رسیدهای ${agent.name}</h3>
                <span class="receipts-count">${receipts.length} رسید</span>
            </div>
    `;
    
    if (receipts.length === 0) {
        html += `
            <div class="empty-state">
                <i class="fas fa-receipt"></i>
                <h3>هیچ رسیدی ثبت نشده</h3>
                <p>هنوز هیچ رسیدی برای این نماینده ثبت نشده است</p>
            </div>
        `;
    } else {
        // مرتب‌سازی رسیدها بر اساس تاریخ (جدیدترین اول)
        receipts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        receipts.forEach((receipt, index) => {
            html += `
                <div class="receipt-card detailed" data-receipt-id="${receipt.id}">
                    <div class="receipt-header">
                        <div class="receipt-info">
                            <div class="receipt-meta">
                                <span class="receipt-number">#${index + 1}</span>
                                <span class="receipt-date">
                                    <i class="fas fa-calendar"></i>
                                    ${persianDate.toPersianDigits(receipt.date)}
                                </span>
                            </div>
                            <div class="receipt-amount">${formatCurrency(receipt.amount)} دالر</div>
                        </div>
                        <button class="btn btn-danger btn-sm delete-receipt" data-receipt-id="${receipt.id}" title="حذف رسید">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <div class="receipt-description">
                        <i class="fas fa-file-alt"></i>
                        ${receipt.description}
                    </div>
                    ${receipt.image ? `
                    <div class="receipt-image-container">
                        <div class="receipt-image">
                            <img src="${receipt.image}" alt="تصویر رسید ${agent.name}">
                            <div class="image-overlay">
                                <button class="btn btn-outline view-image" onclick="viewFullImage('${receipt.image}')">
                                    <i class="fas fa-expand"></i>
                                    مشاهده کامل
                                </button>
                            </div>
                        </div>
                    </div>
                    ` : `
                    <div class="no-image">
                        <i class="fas fa-image"></i>
                        <span>بدون تصویر</span>
                    </div>
                    `}
                    <div class="receipt-footer">
                        <span class="receipt-created">
                            <i class="fas fa-clock"></i>
                            ثبت شده در: ${new Date(receipt.createdAt).toLocaleString('fa-IR')}
                        </span>
                    </div>
                </div>
            `;
        });
    }
    
    html += `</div>`;
    content.innerHTML = html;
    
    // اضافه کردن رویداد حذف رسید
    document.querySelectorAll('.delete-receipt').forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            const receiptId = parseInt(this.getAttribute('data-receipt-id'));
            deleteReceipt(receiptId, agent.id);
        });
    });
    
    // فعال کردن دکمه‌های خروجی برای این نماینده - این خط حیاتی است!
    setupAgentExportFunctions();
    
    modal.classList.add('active');
}

// تابع برای مشاهده تصویر در اندازه کامل
function viewFullImage(imageSrc) {
    const overlay = document.createElement('div');
    overlay.className = 'image-fullscreen-overlay';
    overlay.innerHTML = `
        <div class="image-fullscreen-content">
            <button class="close-fullscreen">&times;</button>
            <img src="${imageSrc}" alt="تصویر کامل رسید">
            <div class="image-actions">
                <button class="btn btn-primary" onclick="downloadImage('${imageSrc}')">
                    <i class="fas fa-download"></i>
                    دانلود
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // بستن overlay
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay || e.target.classList.contains('close-fullscreen')) {
            document.body.removeChild(overlay);
        }
    });
}
// توابع چاپ و خروجی
function setupExportFunctions() {
    document.querySelectorAll('.export-option').forEach(button => {
        button.addEventListener('click', function() {
            const exportType = this.getAttribute('data-type');
            handleExport(exportType);
        });
    });
}

function handleExport(type) {
    switch(type) {
        case 'print':
            printReport();
            break;
        case 'excel':
            exportToExcel();
            break;
        case 'pdf':
            exportToPDF();
            break;
        case 'receipt-print':
            printReceiptTemplate();
            break;
    }
}

// چاپ گزارش کامل
function printReport() {
    // ایجاد یک پنجره جدید برای چاپ
    const printWindow = window.open('', '_blank');
    const currentDate = persianDate.getToday();
    
    // دریافت داده‌ها از دیتابیس
    if (!db) return;
    
    const transaction = db.transaction(['agents', 'receipts'], 'readonly');
    const agentStore = transaction.objectStore('agents');
    const receiptStore = transaction.objectStore('receipts');
    
    Promise.all([
        new Promise(resolve => {
            agentStore.getAll().onsuccess = e => resolve(e.target.result);
        }),
        new Promise(resolve => {
            receiptStore.getAll().onsuccess = e => resolve(e.target.result);
        })
    ]).then(([agents, receipts]) => {
        const totalAmount = receipts.reduce((sum, receipt) => sum + receipt.amount, 0);
        const avgAmount = receipts.length > 0 ? Math.round(totalAmount / receipts.length) : 0;
        
        const printContent = `
            <!DOCTYPE html>
            <html dir="rtl" lang="fa">
            <head>
                <meta charset="UTF-8">
                <title>گزارش مدیریت رسیدها</title>
                <style>
                    body { 
                        font-family: 'Vazirmatn', Tahoma, sans-serif; 
                        margin: 20px; 
                        color: #333;
                    }
                    .print-header { 
                        text-align: center; 
                        border-bottom: 3px solid #4361ee; 
                        padding-bottom: 15px; 
                        margin-bottom: 25px;
                    }
                    .print-summary { 
                        display: grid; 
                        grid-template-columns: repeat(3, 1fr); 
                        gap: 15px; 
                        margin-bottom: 25px;
                    }
                    .print-summary-item { 
                        text-align: center; 
                        padding: 15px; 
                        background: #f8f9fa; 
                        border-radius: 8px;
                        border-right: 4px solid #4361ee;
                    }
                    .agents-section, .receipts-section { 
                        margin-bottom: 30px;
                    }
                    .section-title { 
                        background: #4361ee; 
                        color: white; 
                        padding: 10px 15px; 
                        border-radius: 5px;
                        margin-bottom: 15px;
                    }
                    .agent-item, .receipt-item { 
                        border: 1px solid #ddd; 
                        padding: 12px; 
                        margin-bottom: 10px; 
                        border-radius: 5px;
                        border-right: 3px solid #4361ee;
                    }
                    .receipt-item { 
                        display: flex; 
                        justify-content: space-between; 
                        align-items: center;
                    }
                    @media print {
                        body { margin: 0; }
                        .print-summary { grid-template-columns: repeat(3, 1fr); }
                    }
                </style>
            </head>
            <body>
                <div class="print-header">
                    <h1>گزارش کامل مدیریت رسیدها</h1>
                    <p>تاریخ تهیه گزارش: ${currentDate}</p>
                </div>
                
                <div class="print-summary">
                    <div class="print-summary-item">
                        <h3>${agents.length}</h3>
                        <p>تعداد نمایندگان</p>
                    </div>
                    <div class="print-summary-item">
                        <h3>${receipts.length}</h3>
                        <p>تعداد رسیدها</p>
                    </div>
                    <div class="print-summary-item">
                        <h3>${formatCurrency(totalAmount)}</h3>
                        <p>مجموع مبالغ (دالر)</p>
                    </div>
                </div>
                
                <div class="agents-section">
                    <div class="section-title">
                        <h2>لیست نمایندگان</h2>
                    </div>
                    ${agents.map(agent => `
                        <div class="agent-item">
                            <strong>${agent.name}</strong> - ${agent.phone}
                            ${agent.address ? `<br><small>آدرس: ${agent.address}</small>` : ''}
                        </div>
                    `).join('')}
                </div>
                
                <div class="receipts-section">
                    <div class="section-title">
                        <h2>لیست رسیدها</h2>
                    </div>
                    ${receipts.map(receipt => {
                        const agent = agents.find(a => a.id === receipt.agentId);
                        return `
                            <div class="receipt-item">
                                <div>
                                    <strong>${agent ? agent.name : 'نامشخص'}</strong>
                                    <br>${persianDate.toPersianDigits(receipt.date)} - ${receipt.description}
                                </div>
                                <div>${formatCurrency(receipt.amount)} دالر</div>
                            </div>
                        `;
                    }).join('')}
                </div>
                
                <div style="margin-top: 30px; text-align: center; color: #6c757d; font-size: 0.9rem;">
                    <p>تهیه شده توسط سیستم مدیریت رسیدها</p>
                </div>
            </body>
            </html>
        `;
        
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    });
}
// خروجی Excel برای نماینده - نسخه پیشرفته با اطلاعات تصاویر
function exportAgentToExcel() {
    let excelData = "ردیف\tتاریخ رسید\tشرح رسید\tمبلغ (دالر)\tوضعیت تصویر\tتاریخ ثبت\n";
    
    currentAgentReceipts.forEach((receipt, index) => {
        excelData += `${index + 1}\t`;
        excelData += `${persianDate.toPersianDigits(receipt.date)}\t`;
        excelData += `${receipt.description}\t`;
        excelData += `${receipt.amount}\t`;
        excelData += `${receipt.image ? 'دارای تصویر' : 'بدون تصویر'}\t`;
        excelData += `${new Date(receipt.createdAt).toLocaleString('fa-IR')}\n`;
    });
    
    // اضافه کردن خلاصه
    const totalAmount = currentAgentReceipts.reduce((sum, receipt) => sum + receipt.amount, 0);
    const receiptsWithImages = currentAgentReceipts.filter(receipt => receipt.image).length;
    
    excelData += `\n\nخلاصه:\n`;
    excelData += `نام نماینده:\t${currentAgentData.name}\n`;
    excelData += `تعداد رسیدها:\t${currentAgentReceipts.length}\n`;
    excelData += `رسیدهای دارای تصویر:\t${receiptsWithImages}\n`;
    excelData += `رسیدهای بدون تصویر:\t${currentAgentReceipts.length - receiptsWithImages}\n`;
    excelData += `مجموع مبالغ:\t${totalAmount} دالر\n`;
    excelData += `درصد رسیدهای دارای تصویر:\t${Math.round((receiptsWithImages / currentAgentReceipts.length) * 100)}%\n`;
    
    const blob = new Blob([excelData], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent_${currentAgentData.name}_receipts_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('خروجی Excel با موفقیت ایجاد شد', 'success');
}
// خروجی PDF (با استفاده از jsPDF)
function exportToPDF() {
    // اگر jsPDF موجود نیست، آن را بارگیری کن
    if (typeof jsPDF === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = function() {
            generatePDF();
        };
        document.head.appendChild(script);
        showNotification('در حال بارگیری کتابخانه PDF...', 'info');
    } else {
        generatePDF();
    }
    // تابع کمکی برای بهینه‌سازی نمایش تصاویر در چاپ
function optimizeImageForPrint(imageSrc, maxWidth = 300, maxHeight = 200) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // محاسبه اندازه جدید با حفظ نسبت
            let width = img.width;
            let height = img.height;
            
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
            
            if (height > maxHeight) {
                width = (width * maxHeight) / height;
                height = maxHeight;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = imageSrc;
    });
}
    function generatePDF() {
        if (!db) return;
        
        const transaction = db.transaction(['agents', 'receipts'], 'readonly');
        const agentStore = transaction.objectStore('agents');
        const receiptStore = transaction.objectStore('receipts');
        
        Promise.all([
            new Promise(resolve => {
                agentStore.getAll().onsuccess = e => resolve(e.target.result);
            }),
            new Promise(resolve => {
                receiptStore.getAll().onsuccess = e => resolve(e.target.result);
            })
        ]).then(([agents, receipts]) => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // هدر PDF
            doc.setFont('tahoma');
            doc.setFontSize(20);
            doc.setTextColor(67, 97, 238);
            doc.text('گزارش مدیریت رسیدها', 105, 15, null, null, 'center');
            
            doc.setFontSize(12);
            doc.setTextColor(100, 100, 100);
            doc.text(`تاریخ تهیه گزارش: ${persianDate.getToday()}`, 105, 25, null, null, 'center');
            
            let yPosition = 40;
            
            // آمار کلی
            const totalAmount = receipts.reduce((sum, receipt) => sum + receipt.amount, 0);
            
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.text('آمار کلی:', 20, yPosition);
            yPosition += 10;
            
            doc.setFontSize(12);
            doc.text(`تعداد نمایندگان: ${agents.length}`, 30, yPosition);
            yPosition += 8;
            doc.text(`تعداد رسیدها: ${receipts.length}`, 30, yPosition);
            yPosition += 8;
            doc.text(`مجموع مبالغ: ${formatCurrency(totalAmount)} دالر`, 30, yPosition);
            yPosition += 15;
            
            // لیست رسیدها
            doc.setFontSize(14);
            doc.text('لیست رسیدها:', 20, yPosition);
            yPosition += 10;
            
            doc.setFontSize(10);
            receipts.forEach((receipt, index) => {
                if (yPosition > 270) {
                    doc.addPage();
                    yPosition = 20;
                }
                
                const agent = agents.find(a => a.id === receipt.agentId);
                doc.text(`${index + 1}. ${agent ? agent.name : 'نامشخص'} - ${persianDate.toPersianDigits(receipt.date)}`, 30, yPosition);
                yPosition += 6;
                doc.text(`   ${receipt.description}`, 35, yPosition);
                yPosition += 6;
                doc.text(`   مبلغ: ${formatCurrency(receipt.amount)} دالر`, 35, yPosition);
                yPosition += 10;
            });
            
            // ذخیره فایل
            doc.save(`receipts_report_${new Date().toISOString().split('T')[0]}.pdf`);
            showNotification('خروجی PDF با موفقیت ایجاد شد', 'success');
        });
    }
}

// چاپ قالب رسید
function printReceiptTemplate() {
    const printWindow = window.open('', '_blank');
    
    const printContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="fa">
        <head>
            <meta charset="UTF-8">
            <title>قالب رسید</title>
            <style>
                body { 
                    font-family: 'Courier New', monospace; 
                    margin: 0; 
                    padding: 20px;
                    background: white;
                }
                .receipt-template {
                    width: 300px;
                    margin: 0 auto;
                    border: 2px solid #000;
                    padding: 15px;
                    background: white;
                }
                .receipt-header {
                    text-align: center;
                    border-bottom: 1px dashed #000;
                    padding-bottom: 10px;
                    margin-bottom: 15px;
                }
                .receipt-details {
                    margin-bottom: 15px;
                }
                .receipt-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 5px;
                    font-size: 14px;
                }
                .receipt-footer {
                    border-top: 1px dashed #000;
                    padding-top: 10px;
                    text-align: center;
                    font-size: 12px;
                }
                @media print {
                    body { padding: 0; }
                    .receipt-template { border: none; }
                }
            </style>
        </head>
        <body>
            <div class="receipt-template">
                <div class="receipt-header">
                    <h2 style="margin: 0; font-size: 18px;">رسید پرداخت</h2>
                    <p style="margin: 5px 0; font-size: 14px;">Receipt Manager Pro</p>
                </div>
                
                <div class="receipt-details">
                    <div class="receipt-row">
                        <span>تاریخ:</span>
                        <span>___________</span>
                    </div>
                    <div class="receipt-row">
                        <span>نماینده:</span>
                        <span>___________</span>
                    </div>
                    <div class="receipt-row">
                        <span>شرح:</span>
                        <span>___________</span>
                    </div>
                    <div class="receipt-row" style="border-top: 1px solid #000; padding-top: 5px; margin-top: 5px;">
                        <strong>مبلغ:</strong>
                        <strong>___________ دالر</strong>
                    </div>
                </div>
                
                <div class="receipt-footer">
                    <p style="margin: 5px 0;">با تشکر از اعتماد شما</p>
                    <p style="margin: 5px 0; font-size: 10px;">این سند به صورت خودکار تولید شده است</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
        printWindow.print();
        // printWindow.close(); // می‌توانید این خط را غیرفعال کنید اگر می‌خواهد کاربر خودش پنجره را ببندد
    }, 500);
}
// تابع برای دانلود تصویر
// تابع برای دانلود تصویر
function downloadImage(imageSrc) {
    // استخراج نوع فایل از Data URL
    let fileExtension = 'jpg'; // پیش‌فرض
    let mimeType = 'image/jpeg'; // پیش‌فرض
    
    if (imageSrc.startsWith('data:')) {
        // استخراج MIME type از Data URL
        const matches = imageSrc.match(/^data:(.+?);base64,/);
        if (matches && matches[1]) {
            mimeType = matches[1];
            
            // تعیین پسوند فایل بر اساس MIME type
            if (mimeType.includes('pdf')) {
                fileExtension = 'pdf';
            } else if (mimeType.includes('png')) {
                fileExtension = 'png';
            } else if (mimeType.includes('gif')) {
                fileExtension = 'gif';
            } else if (mimeType.includes('webp')) {
                fileExtension = 'webp';
            } else {
                fileExtension = 'jpg';
            }
        }
    }
    
    // ایجاد لینک دانلود
    const link = document.createElement('a');
    link.href = imageSrc;
    link.download = `receipt_image_${Date.now()}.${fileExtension}`;
    
    // اضافه کردن لینک به صفحه و کلیک کردن
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification(`تصویر با فرمت ${fileExtension.toUpperCase()} دانلود شد`, 'success');
}

// ذخیره رسید
function saveReceipt(event) {
    event.preventDefault();
    
    const agentId = parseInt(document.getElementById('agentSelect').value);
    const date = document.getElementById('receiptDate').value;
    const description = document.getElementById('receiptDescription').value.trim();
    const amount = parseInt(document.getElementById('receiptAmount').value);
    const imageFile = document.getElementById('receiptImage').files[0];
    
    if (!agentId || !date || !description || !amount) {
        showNotification('لطفاً تمام فیلدهای ضروری را پر کنید', 'warning');
        return;
    }
    
    // تبدیل تاریخ به انگلیسی برای ذخیره‌سازی
    const englishDate = persianDate.toEnglishDigits(date);
    
    const receipt = {
        agentId,
        date: englishDate,
        description,
        amount,
        createdAt: new Date()
    };
    
    // اگر تصویری انتخاب شده، آن را تبدیل به Data URL کنید
    if (imageFile) {
        const reader = new FileReader();
        reader.onload = function(e) {
            receipt.image = e.target.result;
            saveReceiptToDB(receipt);
        };
        reader.readAsDataURL(imageFile);
    } else {
        saveReceiptToDB(receipt);
    }
}

// ذخیره رسید در دیتابیس
function saveReceiptToDB(receipt) {
    if (!db) {
        showNotification('خطا در اتصال به دیتابیس', 'error');
        return;
    }
    
    const transaction = db.transaction(['receipts'], 'readwrite');
    const store = transaction.objectStore('receipts');
    const request = store.add(receipt);
    
    request.onsuccess = function() {
        showNotification('رسید با موفقیت ثبت شد', 'success');
        document.getElementById('receiptForm').reset();
        document.getElementById('imagePreview').innerHTML = '';
        document.getElementById('receiptDate').value = persianDate.toPersian();
        
        // به روزرسانی آمار
        updateStats();
    };
    
    request.onerror = function() {
        showNotification('خطا در ثبت رسید', 'error');
    };
}

// پیش‌نمایش تصویر
function previewImage() {
    const file = this.files[0];
    const preview = document.getElementById('imagePreview');
    
    if (file) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            if (file.type.includes('image')) {
                preview.innerHTML = `<img src="${e.target.result}" alt="پیش‌نمایش تصویر">`;
            } else if (file.type === 'application/pdf') {
                preview.innerHTML = `
                    <div class="pdf-preview">
                        <i class="fas fa-file-pdf" style="font-size: 48px; color: #e74c3c;"></i>
                        <p>فایل PDF: ${file.name}</p>
                    </div>
                `;
            }
        };
        
        reader.readAsDataURL(file);
    } else {
        preview.innerHTML = '';
    }
}

// جستجوی رسیدها
function searchReceipts() {
    const searchDate = document.getElementById('searchDate').value;
    
    if (!searchDate) {
        showNotification('لطفاً تاریخ را وارد کنید', 'warning');
        return;
    }
    
    // تبدیل تاریخ به انگلیسی
    const englishDate = persianDate.toEnglishDigits(searchDate);
    
    if (!db) return;
    
    const transaction = db.transaction(['receipts', 'agents'], 'readonly');
    const receiptStore = transaction.objectStore('receipts');
    const agentStore = transaction.objectStore('agents');
    const index = receiptStore.index('date');
    const request = index.getAll(englishDate);
    
    request.onsuccess = function() {
        const receipts = request.result;
        displaySearchResults(receipts, agentStore);
    };
    
    request.onerror = function() {
        showNotification('خطا در جستجو', 'error');
    };
}
function displaySearchResults(receipts, agentStore) {
    const resultsContainer = document.getElementById('searchResults');
    
    if (receipts.length === 0) {
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>هیچ رسیدی برای تاریخ مورد نظر یافت نشد</h3>
            </div>
        `;
        return;
    }
    
    const receiptPromises = receipts.map(receipt => {
        return new Promise((resolve) => {
            const agentRequest = agentStore.get(receipt.agentId);
            agentRequest.onsuccess = function() {
                const agent = agentRequest.result;
                resolve({ ...receipt, agentName: agent ? agent.name : 'نامشخص' });
            };
        });
    });
    
    Promise.all(receiptPromises).then(receiptsWithAgents => {
        let html = '';
        
        receiptsWithAgents.forEach(receipt => {
            html += `
                <div class="receipt-card" data-receipt-id="${receipt.id}">
                    <div class="receipt-header">
                        <div class="receipt-info">
                            <div class="receipt-agent">${receipt.agentName}</div>
                            <div class="receipt-date">${persianDate.toPersianDigits(receipt.date)}</div>
                        </div>
                        <button class="btn btn-danger btn-sm delete-receipt" data-receipt-id="${receipt.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <div class="receipt-description">
                        ${receipt.description}
                    </div>
                    <div class="receipt-amount">${formatCurrency(receipt.amount)} دالر</div>
                    ${receipt.image ? `
                    <div class="receipt-image">
                        <img src="${receipt.image}" alt="تصویر رسید">
                    </div>
                    ` : ''}
                </div>
            `;
        });
        
        resultsContainer.innerHTML = html;
        // در انتهای تابع displaySearchResults فقط این بخش را اضافه کن:
document.querySelectorAll('.delete-receipt').forEach(button => {
    button.addEventListener('click', function() {
        const receiptId = parseInt(this.getAttribute('data-receipt-id'));
        deleteReceipt(receiptId); // اینجا تابع فراخوانی می‌شود توسط کاربر
    });
});
        // اضافه کردن رویداد حذف برای رسیدها در نتایج جستجو
        document.querySelectorAll('.delete-receipt').forEach(button => {
            button.addEventListener('click', function() {
                const receiptId = parseInt(this.getAttribute('data-receipt-id'));
                deleteReceipt(receiptId);
            });
        });
    });
}
// به روزرسانی آمار
function updateStats() {
    if (!db) return;
    
    const transaction = db.transaction(['agents', 'receipts'], 'readonly');
    const agentStore = transaction.objectStore('agents');
    const receiptStore = transaction.objectStore('receipts');
    
    const agentCountRequest = agentStore.count();
    const receiptCountRequest = receiptStore.count();
    const allReceiptsRequest = receiptStore.getAll();
    
    agentCountRequest.onsuccess = function() {
        document.getElementById('totalAgents').textContent = persianDate.toPersianDigits(agentCountRequest.result);
    };
    
    receiptCountRequest.onsuccess = function() {
        document.getElementById('totalReceipts').textContent = persianDate.toPersianDigits(receiptCountRequest.result);
    };
    
    allReceiptsRequest.onsuccess = function() {
        const receipts = allReceiptsRequest.result;
        const totalAmount = receipts.reduce((sum, receipt) => sum + receipt.amount, 0);
        document.getElementById('totalAmount').textContent = formatCurrency(totalAmount);
        
        // اطمینان از به روزرسانی صحیح تعداد رسیدها
        document.getElementById('totalReceipts').textContent = persianDate.toPersianDigits(receipts.length);
    };
}

// بارگذاری آخرین رسیدها
function loadRecentReceipts() {
    if (!db) return;
    
    const transaction = db.transaction(['receipts', 'agents'], 'readonly');
    const receiptStore = transaction.objectStore('receipts');
    const agentStore = transaction.objectStore('agents');
    
    // دریافت 5 رسید آخر
    const request = receiptStore.openCursor(null, 'prev');
    const recentReceipts = [];
    
    request.onsuccess = function(event) {
        const cursor = event.target.result;
        if (cursor && recentReceipts.length < 5) {
            recentReceipts.push(cursor.value);
            cursor.continue();
        } else {
            // دریافت اطلاعات نمایندگان
            const receiptPromises = recentReceipts.map(receipt => {
                return new Promise((resolve) => {
                    const agentRequest = agentStore.get(receipt.agentId);
                    agentRequest.onsuccess = function() {
                        const agent = agentRequest.result;
                        resolve({ ...receipt, agentName: agent ? agent.name : 'نامشخص' });
                    };
                });
            });
            
            Promise.all(receiptPromises).then(receiptsWithAgents => {
                displayRecentReceipts(receiptsWithAgents);
            });
        }
    };
}

// نمایش آخرین رسیدها
function displayRecentReceipts(receipts) {
    const container = document.getElementById('recentReceiptsList');
    
    if (receipts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-receipt"></i>
                <p>هیچ رسیدی ثبت نشده است</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    receipts.forEach(receipt => {
        html += `
            <div class="receipt-item">
                <div class="receipt-item-info">
                    <h4>${receipt.agentName}</h4>
                    <p>${persianDate.toPersianDigits(receipt.date)} - ${receipt.description}</p>
                </div>
                <div class="receipt-item-amount">${formatCurrency(receipt.amount)}دالر</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// پشتیبان‌گیری از داده‌ها
function backupData() {
    if (!db) return;
    
    const transaction = db.transaction(['agents', 'receipts'], 'readonly');
    const agentStore = transaction.objectStore('agents');
    const receiptStore = transaction.objectStore('receipts');
    
    const agentsRequest = agentStore.getAll();
    const receiptsRequest = receiptStore.getAll();
    
    Promise.all([
        new Promise(resolve => { agentsRequest.onsuccess = () => resolve(agentsRequest.result); }),
        new Promise(resolve => { receiptsRequest.onsuccess = () => resolve(receiptsRequest.result); })
    ]).then(([agents, receipts]) => {
        const backupData = {
            agents,
            receipts,
            backupDate: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(backupData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const url = URL.createObjectURL(dataBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `receipt_manager_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification('پشتیبان با موفقیت ایجاد شد', 'success');
    });
}

// بازیابی داده‌ها
function restoreData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const backupData = JSON.parse(e.target.result);
            
            if (!backupData.agents || !backupData.receipts) {
                throw new Error('فایل پشتیبان معتبر نیست');
            }
            
            if (!confirm(`آیا از بازیابی این پشتیبان اطمینان دارید؟ این عمل تمام داده‌های فعلی را جایگزین می‌کند.`)) {
                return;
            }
            
            restoreBackupData(backupData);
        } catch (error) {
            console.error('خطا در بازیابی پشتیبان:', error);
            showNotification('فایل پشتیبان معتبر نیست', 'error');
        }
    };
    
    reader.readAsText(file);
    // ریست کردن مقدار input برای امکان انتخاب مجدد همان فایل
    event.target.value = '';
}

// بازیابی داده‌های پشتیبان
function restoreBackupData(backupData) {
    if (!db) return;
    
    const transaction = db.transaction(['agents', 'receipts'], 'readwrite');
    const agentStore = transaction.objectStore('agents');
    const receiptStore = transaction.objectStore('receipts');
    
    // پاک کردن داده‌های موجود
    agentStore.clear();
    receiptStore.clear();
    
    // افزودن داده‌های پشتیبان
    backupData.agents.forEach(agent => {
        agentStore.add(agent);
    });
    
    backupData.receipts.forEach(receipt => {
        receiptStore.add(receipt);
    });
    
    transaction.oncomplete = function() {
        showNotification('داده‌ها با موفقیت بازیابی شدند', 'success');
        loadAgents();
        updateStats();
        loadRecentReceipts();
        populateAgentSelect();
    };
    
    transaction.onerror = function() {
        showNotification('خطا در بازیابی داده‌ها', 'error');
    };
}
// پاک کردن تمام داده‌های برنامه
function clearAllData() {
    if (!confirm('⚠️ آیا از پاک کردن تمام داده‌های برنامه اطمینان دارید؟\nاین عمل غیرقابل بازگشت است!')) {
        return;
    }
    
    if (!db) {
        showNotification('خطا در اتصال به دیتابیس', 'error');
        return;
    }
    
    const transaction = db.transaction(['agents', 'receipts'], 'readwrite');
    const agentStore = transaction.objectStore('agents');
    const receiptStore = transaction.objectStore('receipts');
    
    // پاک کردن تمام داده‌ها
    const clearAgents = agentStore.clear();
    const clearReceipts = receiptStore.clear();
    
    transaction.oncomplete = function() {
        showNotification('✅ تمام داده‌ها با موفقیت پاک شدند', 'success');
        
        // به روزرسانی رابط کاربری
        loadAgents();
        updateStats();
        loadRecentReceipts();
        populateAgentSelect();
        
        // پاک کردن فرم‌ها
        document.getElementById('receiptForm').reset();
        document.getElementById('imagePreview').innerHTML = '';
    };
    
    transaction.onerror = function() {
        showNotification('❌ خطا در پاک کردن داده‌ها', 'error');
    };
}
// نمایش ناتفیکیشن
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// فرمت کردن مبلغ به صورت زیبا
function formatCurrency(amount) {
    return persianDate.toPersianDigits(amount.toLocaleString());
}
// اضافه کردن این توابع در انتهای فایل، قبل از showNotification

// تابع برای مشاهده تصویر در اندازه کامل
function viewFullImage(imageSrc) {
    const overlay = document.createElement('div');
    overlay.className = 'image-fullscreen-overlay';
    overlay.innerHTML = `
        <div class="image-fullscreen-content">
            <button class="close-fullscreen">&times;</button>
            <img src="${imageSrc}" alt="تصویر کامل رسید">
            <div class="image-actions">
                <button class="btn btn-primary" onclick="downloadImage('${imageSrc}')">
                    <i class="fas fa-download"></i>
                    دانلود
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // بستن overlay
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay || e.target.classList.contains('close-fullscreen')) {
            document.body.removeChild(overlay);
        }
    });
}

// تابع پیشرفته برای دانلود تصویر
function downloadImage(imageSrc) {
    try {
        // اگر فایل PDF است، رفتار متفاوتی داشته باش
        if (imageSrc.includes('application/pdf') || imageSrc.includes('data:application/pdf')) {
            // برای PDF از روش مستقیم استفاده کن
            const link = document.createElement('a');
            link.href = imageSrc;
            link.download = `receipt_document_${Date.now()}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showNotification('فایل PDF دانلود شد', 'success');
            return;
        }
        
        // برای تصاویر، از Canvas استفاده کن تا کیفیت حفظ شود
        if (imageSrc.startsWith('data:image/')) {
            const img = new Image();
            img.onload = function() {
                // ایجاد Canvas برای پردازش تصویر
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                
                // تبدیل به Blob با کیفیت اصلی
                canvas.toBlob(function(blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    
                    // تشخیص فرمت از MIME type
                    let extension = 'jpg';
                    if (blob.type.includes('png')) extension = 'png';
                    else if (blob.type.includes('gif')) extension = 'gif';
                    else if (blob.type.includes('webp')) extension = 'webp';
                    
                    link.download = `receipt_image_${Date.now()}.${extension}`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    
                    // آزاد کردن memory
                    setTimeout(() => URL.revokeObjectURL(url), 100);
                    
                    showNotification(`تصویر با فرمت ${extension.toUpperCase()} دانلود شد`, 'success');
                }, 'image/jpeg', 1.0); // کیفیت 100%
            };
            
            img.src = imageSrc;
        } else {
            // روش معمول برای سایر فایل‌ها
            const link = document.createElement('a');
            link.href = imageSrc;
            link.download = `receipt_file_${Date.now()}.${getFileExtension(imageSrc)}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showNotification('فایل دانلود شد', 'success');
        }
    } catch (error) {
        console.error('خطا در دانلود تصویر:', error);
        showNotification('خطا در دانلود فایل', 'error');
        
        // روش fallback
        const link = document.createElement('a');
        link.href = imageSrc;
        link.download = `receipt_${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// تابع کمکی برای تشخیص پسوند فایل
function getFileExtension(dataUrl) {
    if (dataUrl.includes('application/pdf')) return 'pdf';
    if (dataUrl.includes('image/png')) return 'png';
    if (dataUrl.includes('image/gif')) return 'gif';
    if (dataUrl.includes('image/webp')) return 'webp';
    if (dataUrl.includes('image/jpeg') || dataUrl.includes('image/jpg')) return 'jpg';
    return 'jpg'; // پیش‌فرض
}
// ثبت Service Worker برای PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('./sw.js')
            .then(function(registration) {
                console.log('ServiceWorker registration successful');
            })
            .catch(function(error) {
                console.log('ServiceWorker registration failed: ', error);
            });
    });
}
// مدیریت نصب PWA
let deferredPrompt;
const installButton = document.createElement('button');

function createInstallButton() {
    installButton.innerHTML = '<i class="fas fa-download"></i> نصب برنامه';
    installButton.className = 'btn btn-success install-btn';
    installButton.style.marginRight = '10px';
    installButton.style.display = 'none';
    
    const headerActions = document.querySelector('.header-actions');
    if (headerActions) {
        headerActions.insertBefore(installButton, headerActions.firstChild);
    }
    
    installButton.addEventListener('click', installPWA);
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installButton.style.display = 'block';
    
    showNotification('برنامه آماده نصب است!', 'info');
});

function installPWA() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
                installButton.style.display = 'none';
                showNotification('برنامه با موفقیت نصب شد!', 'success');
            }
            deferredPrompt = null;
        });
    }
}

window.addEventListener('appinstalled', (evt) => {
    console.log('App was installed successfully');
    installButton.style.display = 'none';
});

// ایجاد دکمه نصب هنگام لود صفحه
document.addEventListener('DOMContentLoaded', function() {
    createInstallButton();
    
    // ثبت Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(function(registration) {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(function(error) {
                console.log('ServiceWorker registration failed: ', error);
            });
    }
});