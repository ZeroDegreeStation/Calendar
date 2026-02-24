/**
 * SnowStation Integration - Links Calendar with Booking Form
 */
class SnowStationIntegration {
    constructor() {
        console.log('🏔️ Initializing SnowStation Integration...');
        
        this.bookingSystem = null;
        this.excelHandler = new ExcelHandler();
        
        this.planPrices = {
            'weekend-getaway': 12800,
            'ski-adventure': 18500,
            'family-package': 32000
        };
        
        this.planNames = {
            'weekend-getaway': 'Weekend Getaway',
            'ski-adventure': 'Ski Adventure',
            'family-package': 'Family Ski Package'
        };
        
        // Mobile detection
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this._processingTouch = false;
        
        this.init();
    }

    async init() {
        await this.waitForBookingSystem();
        this.setupEventListeners();
        this.setupPlanSelection();
        this.setupPaymentHandlers();
        console.log('✅ SnowStation Integration ready' + (this.isMobile ? ' (Mobile mode)' : ''));
    }

    async waitForBookingSystem() {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (window.bookingSystem) {
                    this.bookingSystem = window.bookingSystem;
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
            setTimeout(() => resolve(), 5000);
        });
    }

    setupEventListeners() {
        document.addEventListener('datesSelected', (e) => {
            this.syncDatesToForm(e.detail);
        });
        
        const planSelect = document.getElementById('selected-plan');
        if (planSelect) {
            planSelect.addEventListener('change', () => {
                this.updateSelectedPlanDisplay();
                this.updatePricing();
                if (this.bookingSystem) {
                    const price = this.planPrices[planSelect.value] || 0;
                    const name = this.planNames[planSelect.value] || '';
                    this.bookingSystem.planPrice = price;
                    this.bookingSystem.planName = name;
                    this.bookingSystem.updateBookingSummary();
                }
            });
        }
        
        const guestsSelect = document.getElementById('guests');
        if (guestsSelect) {
            guestsSelect.addEventListener('change', () => this.updatePricing());
        }
        
        const completeBtn = document.getElementById('completeBookingBtn');
        if (completeBtn) {
            completeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleBookingSubmission();
            });
            
            if (this.isMobile) {
                completeBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (!this._processingTouch) {
                        this._processingTouch = true;
                        this.handleBookingSubmission();
                        setTimeout(() => { this._processingTouch = false; }, 1000);
                    }
                }, { passive: false });
            }
        }
        
        const checkinInput = document.getElementById('checkin');
        const checkoutInput = document.getElementById('checkout');
        
        if (checkinInput) {
            checkinInput.addEventListener('change', () => this.updatePricing());
        }
        
        if (checkoutInput) {
            checkoutInput.addEventListener('change', () => this.updatePricing());
        }
    }

    setupPlanSelection() {
        document.querySelectorAll('.select-plan-btn').forEach(button => {
            button.addEventListener('click', (e) => this.handlePlanClick(e));
            if (this.isMobile) {
                button.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    this.handlePlanClick(e);
                }, { passive: false });
            }
        });
    }

    handlePlanClick(e) {
        const button = e.currentTarget;
        const planValue = button.getAttribute('data-plan');
        const planPrice = button.getAttribute('data-price');
        const planName = button.getAttribute('data-plan-name');
        
        const planSelect = document.getElementById('selected-plan');
        if (planSelect) {
            planSelect.value = planValue;
            planSelect.setAttribute('data-price', planPrice);
            
            if (this.bookingSystem) {
                this.bookingSystem.planPrice = parseInt(planPrice);
                this.bookingSystem.planName = planName;
                this.bookingSystem.updateBookingSummary();
            }
            
            this.updateSelectedPlanDisplay();
            this.updatePricing();
        }
        
        document.getElementById('calendar-section')?.scrollIntoView({ behavior: 'smooth' });
        this.showNotification(`✓ Selected: ${planName}`, 'success');
    }

    setupPaymentHandlers() {
        document.querySelectorAll('.payment-method').forEach(method => {
            method.addEventListener('click', (e) => this.handlePaymentMethodClick(e));
            if (this.isMobile) {
                method.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    this.handlePaymentMethodClick(e);
                }, { passive: false });
            }
        });

        const cardNumber = document.getElementById('cardNumber');
        if (cardNumber) cardNumber.addEventListener('input', this.formatCardNumber);

        const expiryDate = document.getElementById('expiryDate');
        if (expiryDate) expiryDate.addEventListener('input', this.formatExpiryDate);

        const cvv = document.getElementById('cvv');
        if (cvv) cvv.addEventListener('input', this.formatCVV);
    }

    handlePaymentMethodClick(e) {
        const currentMethod = e.currentTarget;
        
        document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('selected'));
        currentMethod.classList.add('selected');
        
        const radio = currentMethod.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
        
        const methodType = currentMethod.getAttribute('data-method');
        const detailsMap = {
            'credit-card': 'creditCardDetails',
            'paypal': 'paypalDetails',
            'pay-at-hotel': 'payAtHotelDetails'
        };
        
        document.querySelectorAll('.payment-details').forEach(d => d.classList.remove('active'));
        
        const detailsId = detailsMap[methodType];
        if (detailsId) {
            const detailsEl = document.getElementById(detailsId);
            if (detailsEl) detailsEl.classList.add('active');
        }
    }

    syncDatesToForm(detail) {
        const dates = detail.dates || [];
        const checkinDate = detail.checkin;
        const checkoutDate = detail.checkout;
        
        const checkinInput = document.getElementById('checkin');
        const checkoutInput = document.getElementById('checkout');
        
        if (!dates || dates.length === 0) {
            if (checkinInput) checkinInput.value = '';
            if (checkoutInput) checkoutInput.value = '';
            return;
        }
        
        if (checkinInput && checkinDate) checkinInput.value = checkinDate;
        if (checkoutInput && checkoutDate) checkoutInput.value = checkoutDate;
        
        this.updatePricing();
    }

    calculateNights(checkin, checkout) {
        if (!checkin || !checkout) return 0;
        const start = new Date(checkin);
        const end = new Date(checkout);
        return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    }

    formatDate(dateStr) {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric'
        });
    }

    updateSelectedPlanDisplay() {
        const planSelect = document.getElementById('selected-plan');
        const planInfo = document.getElementById('selectedPlanInfo');
        
        if (!planSelect || !planInfo) return;
        
        const selectedValue = planSelect.value;
        
        if (selectedValue) {
            const planName = this.planNames[selectedValue] || 'Selected Plan';
            const price = this.planPrices[selectedValue] || 0;
            
            planInfo.innerHTML = `
                <div style="display: flex; justify-content: space-between;">
                    <div>
                        <span style="color: #666;">Selected Plan:</span>
                        <span style="font-weight: 600; color: #2c3e50;">${planName}</span>
                    </div>
                    <div style="text-align: right;">
                        <span style="color: #666;">¥${price.toLocaleString()}/night</span>
                    </div>
                </div>
            `;
        } else {
            planInfo.innerHTML = '<span style="color: #999;">Please select a stay plan</span>';
        }
    }

    updatePricing() {
        const checkin = document.getElementById('checkin')?.value;
        const checkout = document.getElementById('checkout')?.value;
        const planSelect = document.getElementById('selected-plan');
        
        if (!planSelect || !checkin || !checkout) return;
        
        const planPrice = parseInt(planSelect.getAttribute('data-price')) || 
                         this.planPrices[planSelect.value] || 0;
        
        if (planPrice > 0) {
            const nights = this.calculateNights(checkin, checkout);
            const roomRate = planPrice * nights;
            const tax = Math.round(roomRate * 0.1);
            const serviceCharge = 1000;
            const total = roomRate + tax + serviceCharge;
            
            document.getElementById('nightCount').textContent = nights;
            document.getElementById('roomRate').textContent = `¥${roomRate.toLocaleString()}`;
            document.getElementById('taxAmount').textContent = `¥${tax.toLocaleString()}`;
            document.getElementById('totalAmount').textContent = `¥${total.toLocaleString()}`;
        }
    }

    async handleBookingSubmission() {
        const name = document.getElementById('name')?.value;
        const email = document.getElementById('email')?.value;
        const phone = document.getElementById('phone')?.value;
        const plan = document.getElementById('selected-plan')?.value;
        const checkin = document.getElementById('checkin')?.value;
        const checkout = document.getElementById('checkout')?.value;
        const guests = document.getElementById('guests')?.value;
        const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked');
        const terms = document.getElementById('terms')?.checked;
        const requests = document.getElementById('message')?.value;
        
        if (!name || !email || !phone || !plan || !checkin || !checkout || !guests) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        if (!paymentMethod) {
            this.showNotification('Please select a payment method', 'error');
            return;
        }
        
        if (!terms) {
            this.showNotification('Please agree to the Terms & Conditions', 'error');
            return;
        }
        
        if (paymentMethod.value === 'credit-card') {
            const cardNumber = document.getElementById('cardNumber')?.value.replace(/\s+/g, '');
            if (!cardNumber || cardNumber.length < 16) {
                this.showNotification('Please enter a valid card number', 'error');
                return;
            }
        }
        
        if (this.bookingSystem && this.bookingSystem.selectedDates.length > 0) {
            const btn = document.getElementById('completeBookingBtn');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            btn.disabled = true;
            
            const result = await this.bookingSystem.submitBooking({
                name, email, phone, guests: parseInt(guests), requests
            });
            
            if (result.success) {
                this.resetForm();
                this.showNotification(`Booking confirmed! Reference: ${result.bookingId}`, 'success');
            } else {
                this.showNotification('Booking failed. Please try again.', 'error');
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        } else {
            this.showNotification('Please select dates from the calendar', 'error');
        }
    }

    resetForm() {
        document.getElementById('guestForm')?.reset();
        const planSelect = document.getElementById('selected-plan');
        if (planSelect) {
            planSelect.value = '';
            planSelect.removeAttribute('data-price');
        }
        document.getElementById('selectedPlanInfo').innerHTML = '<span style="color: #999;">Please select a stay plan</span>';
        document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('selected'));
        document.querySelectorAll('.payment-details').forEach(d => d.classList.remove('active'));
        document.querySelectorAll('input[name="paymentMethod"]').forEach(r => r.checked = false);
        document.getElementById('terms').checked = false;
        if (this.bookingSystem) this.bookingSystem.clearDateSelection(false);
        this.updatePricing();
    }

    formatCardNumber(e) {
        let value = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        e.target.value = value.replace(/(\d{4})/g, '$1 ').trim().substring(0, 19);
    }

    formatExpiryDate(e) {
        let value = e.target.value.replace(/[^0-9]/g, '');
        if (value.length >= 2) value = value.substring(0, 2) + '/' + value.substring(2, 4);
        e.target.value = value.substring(0, 5);
    }

    formatCVV(e) {
        e.target.value = e.target.value.replace(/[^0-9]/g, '').substring(0, 3);
    }

    showNotification(message, type = 'info') {
        console.log(`[${type}] ${message}`);
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; padding: 1rem 1.5rem;
            background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
            color: white; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999; animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
}

// Initialize
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            window.snowStation = new SnowStationIntegration();
        }, 1000);
    });
}