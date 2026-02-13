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
        
        this.init();
    }

    async init() {
        await this.waitForBookingSystem();
        this.setupEventListeners();
        this.setupPlanSelection();
        this.setupPaymentHandlers();
        console.log('✅ SnowStation Integration ready');
    }

    async waitForBookingSystem() {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (window.calendar) {
                    this.bookingSystem = window.calendar;
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
            
            setTimeout(() => {
                clearInterval(checkInterval);
                resolve();
            }, 5000);
        });
    }

    setupEventListeners() {
        // Listen for date selection from calendar
        document.addEventListener('datesSelected', (e) => {
            this.syncDatesToForm(e.detail.dates);
        });
        
        // Plan selection change
        const planSelect = document.getElementById('selected-plan');
        if (planSelect) {
            planSelect.addEventListener('change', () => {
                this.updateSelectedPlanDisplay();
                this.updatePricing();
            });
        }
        
        // Guest count change
        const guestsSelect = document.getElementById('guests');
        if (guestsSelect) {
            guestsSelect.addEventListener('change', () => {
                this.updatePricing();
            });
        }
        
        // Complete booking button
        const completeBtn = document.getElementById('completeBookingBtn');
        if (completeBtn) {
            completeBtn.addEventListener('click', () => {
                this.handleBookingSubmission();
            });
        }
        
        // Close modal buttons
        const closeModalBtn = document.getElementById('closeEmailModal');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                document.getElementById('emailModal')?.classList.remove('active');
            });
        }
        
        const finishBtn = document.getElementById('finishBookingBtn');
        if (finishBtn) {
            finishBtn.addEventListener('click', () => {
                document.getElementById('emailModal')?.classList.remove('active');
                this.resetForm();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
    }

    setupPlanSelection() {
        document.querySelectorAll('.select-plan-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const planValue = e.currentTarget.getAttribute('data-plan');
                const planPrice = e.currentTarget.getAttribute('data-price');
                const planName = e.currentTarget.getAttribute('data-plan-name');
                
                const planSelect = document.getElementById('selected-plan');
                if (planSelect) {
                    planSelect.value = planValue;
                    planSelect.setAttribute('data-price', planPrice);
                    this.updateSelectedPlanDisplay();
                    this.updatePricing();
                }
                
                // Scroll to calendar section
                document.getElementById('calendar-section')?.scrollIntoView({ 
                    behavior: 'smooth' 
                });
                
                this.showNotification(`✓ Selected: ${planName}`, 'success');
            });
        });
    }

    setupPaymentHandlers() {
        // Payment method selection
        document.querySelectorAll('.payment-method').forEach(method => {
            method.addEventListener('click', (e) => {
                const currentMethod = e.currentTarget;
                
                document.querySelectorAll('.payment-method').forEach(m => {
                    m.classList.remove('selected');
                });
                
                currentMethod.classList.add('selected');
                
                const radio = currentMethod.querySelector('input[type="radio"]');
                if (radio) radio.checked = true;
                
                const methodType = currentMethod.getAttribute('data-method');
                const detailsMap = {
                    'credit-card': 'creditCardDetails',
                    'paypal': 'paypalDetails',
                    'bank-transfer': 'bankTransferDetails',
                    'pay-at-hotel': 'payAtHotelDetails'
                };
                
                document.querySelectorAll('.payment-details').forEach(d => {
                    d.classList.remove('active');
                });
                
                const detailsId = detailsMap[methodType];
                if (detailsId) {
                    const detailsEl = document.getElementById(detailsId);
                    if (detailsEl) detailsEl.classList.add('active');
                }
            });
        });

        // Format card inputs
        const cardNumber = document.getElementById('cardNumber');
        if (cardNumber) {
            cardNumber.addEventListener('input', this.formatCardNumber);
        }

        const expiryDate = document.getElementById('expiryDate');
        if (expiryDate) {
            expiryDate.addEventListener('input', this.formatExpiryDate);
        }

        const cvv = document.getElementById('cvv');
        if (cvv) {
            cvv.addEventListener('input', this.formatCVV);
        }
    }

    syncDatesToForm(dates) {
        const checkinInput = document.getElementById('checkin');
        const checkoutInput = document.getElementById('checkout');
        const displayEl = document.getElementById('selectedDatesDisplay');
        const rangeEl = document.getElementById('selectedDatesRange');
        
        if (!dates || dates.length === 0) {
            if (displayEl) displayEl.style.display = 'none';
            if (checkinInput) checkinInput.value = '';
            if (checkoutInput) checkoutInput.value = '';
            return;
        }
        
        const checkinDate = dates[0];
        const checkoutDate = this.calculateCheckoutDate(dates);
        
        if (checkinInput) checkinInput.value = checkinDate;
        if (checkoutInput) checkoutInput.value = checkoutDate;
        
        if (displayEl && rangeEl) {
            const nights = this.calculateNights(checkinDate, checkoutDate);
            const checkinDisplay = this.formatDate(checkinDate);
            const checkoutDisplay = this.formatDate(checkoutDate);
            
            rangeEl.innerHTML = `
                <div class="date-item">
                    <span class="date-label">CHECK-IN</span>
                    <span class="date-value">${checkinDisplay}</span>
                </div>
                <div style="color: white; font-size: 1.2rem;">
                    <i class="fas fa-arrow-right"></i>
                </div>
                <div class="date-item">
                    <span class="date-label">CHECK-OUT</span>
                    <span class="date-value">${checkoutDisplay}</span>
                </div>
                <div style="margin-left: auto;">
                    <span class="date-label">NIGHTS</span>
                    <span class="date-value">${nights}</span>
                </div>
            `;
            
            displayEl.style.display = 'block';
        }
        
        this.updatePricing();
    }

    calculateCheckoutDate(dates) {
        if (dates.length === 0) return '';
        const lastDate = new Date(dates[dates.length - 1]);
        lastDate.setDate(lastDate.getDate() + 1);
        return lastDate.toISOString().split('T')[0];
    }

    calculateNights(checkin, checkout) {
        if (!checkin || !checkout) return 0;
        const start = new Date(checkin);
        const end = new Date(checkout);
        const diffTime = Math.abs(end - start);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
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
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="display: block; margin-bottom: 0.3rem; color: #666;">Selected Plan:</span>
                        <span style="font-size: 1.1rem; font-weight: 600; color: #2c3e50;">${planName}</span>
                    </div>
                    <div style="text-align: right;">
                        <span style="display: block; color: #666; font-size: 0.9rem;">Rate per night</span>
                        <span style="font-size: 1.2rem; font-weight: 700; color: #27ae60;">¥${price.toLocaleString()}</span>
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
            
            const nightCountEl = document.getElementById('nightCount');
            const roomRateEl = document.getElementById('roomRate');
            const taxAmountEl = document.getElementById('taxAmount');
            const totalAmountEl = document.getElementById('totalAmount');
            
            if (nightCountEl) nightCountEl.textContent = nights;
            if (roomRateEl) roomRateEl.textContent = `¥${roomRate.toLocaleString()}`;
            if (taxAmountEl) taxAmountEl.textContent = `¥${tax.toLocaleString()}`;
            if (totalAmountEl) totalAmountEl.textContent = `¥${total.toLocaleString()}`;
        }
    }

    async handleBookingSubmission() {
        // Validate required fields
        const name = document.getElementById('name')?.value;
        const email = document.getElementById('email')?.value;
        const phone = document.getElementById('phone')?.value;
        const plan = document.getElementById('selected-plan')?.value;
        const checkin = document.getElementById('checkin')?.value;
        const checkout = document.getElementById('checkout')?.value;
        const guests = document.getElementById('guests')?.value;
        const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked');
        const terms = document.getElementById('terms')?.checked;
        
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
        
        // Validate credit card if selected
        if (paymentMethod.value === 'credit-card') {
            const cardNumber = document.getElementById('cardNumber')?.value.replace(/\s+/g, '');
            const cardName = document.getElementById('cardName')?.value;
            const expiryDate = document.getElementById('expiryDate')?.value;
            const cvv = document.getElementById('cvv')?.value;
            
            if (!cardNumber || cardNumber.length < 16) {
                this.showNotification('Please enter a valid card number', 'error');
                return;
            }
            
            if (!cardName) {
                this.showNotification('Please enter the name on card', 'error');
                return;
            }
            
            if (!expiryDate || expiryDate.length < 5) {
                this.showNotification('Please enter a valid expiry date', 'error');
                return;
            }
            
            if (!cvv || cvv.length < 3) {
                this.showNotification('Please enter a valid CVV', 'error');
                return;
            }
        }
        
        // Show email modal
        this.showEmailModal(name, email, plan, checkin, checkout, guests);
        
        // Save booking to calendar system
        if (this.bookingSystem && this.bookingSystem.selectedDates.length > 0) {
            // Set customer info in booking system
            const customerNameInput = document.getElementById('customerName');
            const customerEmailInput = document.getElementById('customerEmail');
            const customerPhoneInput = document.getElementById('customerPhone');
            const guestsSelect = document.getElementById('guests');
            
            if (customerNameInput) customerNameInput.value = name;
            if (customerEmailInput) customerEmailInput.value = email;
            if (customerPhoneInput) customerPhoneInput.value = phone;
            
            await this.bookingSystem.submitBooking(new Event('submit'));
        }
    }

    showEmailModal(name, email, plan, checkin, checkout, guests) {
        const modal = document.getElementById('emailModal');
        const customerEmailEl = document.getElementById('customerEmail');
        const progressText = document.getElementById('progressText');
        const step2 = document.getElementById('step2');
        const line2 = document.getElementById('line2');
        const step3 = document.getElementById('step3');
        const successMessage = document.getElementById('successMessage');
        
        if (customerEmailEl) customerEmailEl.textContent = email;
        
        // Reset progress
        if (step2) {
            step2.classList.remove('completed');
            step2.classList.add('active');
        }
        if (line2) line2.classList.remove('completed');
        if (step3) step3.classList.remove('completed', 'active');
        if (successMessage) successMessage.style.display = 'none';
        if (progressText) progressText.textContent = 'Processing your booking...';
        
        // Show modal
        if (modal) modal.classList.add('active');
        
        // Simulate email sending
        setTimeout(() => {
            if (progressText) progressText.textContent = 'Sending confirmation emails...';
            if (step2) {
                step2.classList.remove('active');
                step2.classList.add('completed');
            }
            if (line2) line2.classList.add('completed');
            if (step3) step3.classList.add('active');
        }, 1500);
        
        setTimeout(() => {
            if (progressText) progressText.textContent = 'Emails sent successfully!';
            if (step3) {
                step3.classList.remove('active');
                step3.classList.add('completed');
            }
            
            setTimeout(() => {
                if (successMessage) successMessage.style.display = 'block';
            }, 500);
        }, 3000);
    }

    resetForm() {
        const form = document.getElementById('guestForm');
        if (form) form.reset();
        
        const planSelect = document.getElementById('selected-plan');
        if (planSelect) {
            planSelect.value = '';
            planSelect.removeAttribute('data-price');
        }
        
        const planInfo = document.getElementById('selectedPlanInfo');
        if (planInfo) {
            planInfo.innerHTML = '<span style="color: #999;">Please select a stay plan</span>';
        }
        
        const displayEl = document.getElementById('selectedDatesDisplay');
        if (displayEl) displayEl.style.display = 'none';
        
        document.querySelectorAll('.payment-method').forEach(m => {
            m.classList.remove('selected');
        });
        
        document.querySelectorAll('.payment-details').forEach(d => {
            d.classList.remove('active');
        });
        
        document.querySelectorAll('input[name="paymentMethod"]').forEach(r => {
            r.checked = false;
        });
        
        const terms = document.getElementById('terms');
        if (terms) terms.checked = false;
        
        if (this.bookingSystem) {
            this.bookingSystem.clearDateSelection(false);
        }
        
        this.updatePricing();
    }

    formatCardNumber(e) {
        let value = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        let formatted = value.replace(/(\d{4})/g, '$1 ').trim();
        e.target.value = formatted.substring(0, 19);
    }

    formatExpiryDate(e) {
        let value = e.target.value.replace(/[^0-9]/g, '');
        if (value.length >= 2) {
            value = value.substring(0, 2) + '/' + value.substring(2, 4);
        }
        e.target.value = value.substring(0, 5);
    }

    formatCVV(e) {
        e.target.value = e.target.value.replace(/[^0-9]/g, '').substring(0, 3);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
            color: white;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            animation: slideIn 0.3s ease;
            display: flex;
            align-items: center;
            gap: 0.8rem;
        `;
        
        notification.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Add slide animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);

// Initialize
window.SnowStationIntegration = SnowStationIntegration;