/**
 * Kalkulačka výhodnosti - Vzorný nájemce
 * Komponenta pro výpočet úspor při použití služeb Vzorný nájemce
 */

class SavingsCalculator {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.data = {
            hourlyRate: 300,
            monthlyRent: 15000,
            // Výchozí hodnoty pro výpočty
            timeSpentSelfManagement: 96, // hodin ročně při vlastní správě
            problemTenantCosts: 25000, // průměrné náklady na problémového nájemníka
            vacancyMonths: 2, // průměrná doba neobsazenosti při vlastní správě
            legalCosts: 15000, // právní náklady při problémech
            repairCosts: 8000, // průměrné roční náklady na opravy
        };
        
        this.init();
    }

    init() {
        this.render();
        this.attachEventListeners();
        this.calculate();
    }

    render() {
        this.container.innerHTML = `
            <div class="bg-white rounded-3xl shadow-xl p-8 max-w-4xl mx-auto border border-gray-200">
                <div class="text-center mb-8">
                    <h2 class="text-3xl font-bold text-gray-900 mb-4">Ušetřete se Vzorným nájemcem</h2>
                    <p class="text-lg text-gray-600">Spočítejte si, kolik ušetříte s profesionální správou</p>
                </div>

                <!-- Vstupní hodnoty -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div class="bg-gray-50 rounded-xl p-6">
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            Vaše hodinová sazba (Kč/hod)
                        </label>
                        <input 
                            type="number" 
                            id="hourlyRate" 
                            value="${this.data.hourlyRate}"
                            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0D28F2] focus:border-transparent text-lg font-semibold"
                            min="100" 
                            max="2000" 
                            step="50"
                        >
                        <p class="text-sm text-gray-500 mt-1">Kolik si ceníte svůj čas</p>
                    </div>

                    <div class="bg-gray-50 rounded-xl p-6">
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            Měsíční nájemné (Kč)
                        </label>
                        <input 
                            type="number" 
                            id="monthlyRent" 
                            value="${this.data.monthlyRent}"
                            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0D28F2] focus:border-transparent text-lg font-semibold"
                            min="5000" 
                            max="50000" 
                            step="1000"
                        >
                        <p class="text-sm text-gray-500 mt-1">Výše měsíčního nájmu</p>
                    </div>
                </div>

                <!-- Výsledky -->
                <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 mb-6">
                    <h3 class="text-xl font-bold text-gray-900 mb-6 text-center">Porovnání nákladů za rok</h3>
                    
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <!-- Vlastní správa -->
                        <div class="bg-white rounded-xl p-6 border-2 border-gray-200">
                            <div class="text-center mb-4">
                                <h4 class="text-lg font-bold text-gray-700 mb-2">Vlastní správa</h4>
                                <div class="text-2xl font-bold text-gray-800" id="selfManagementTotal">0 Kč</div>
                            </div>
                            
                            <div class="space-y-3 text-sm">
                                <div class="flex justify-between group relative">
                                    <div class="flex items-center">
                                        <span class="text-gray-600">Čas strávený správou:</span>
                                        <div class="ml-1 relative group">
                                            <svg class="w-4 h-4 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                            </svg>
                                            <div class="hidden group-hover:block absolute z-10 w-64 p-3 -left-32 -top-20 bg-white shadow-lg rounded-lg text-sm text-gray-600">
                                                <strong>96 hodin ročně</strong> (8 hodin měsíčně) včetně:<br>
                                                • Komunikace s nájemníky (24h)<br>
                                                • Návštěvy bytu (12h)<br>
                                                • Administrativa (24h)<br>
                                                • Řešení problémů (36h)<br>
                                                <em>Při hodinové sazbě 300 Kč</em>
                                            </div>
                                        </div>
                                    </div>
                                    <span class="font-semibold" id="timeSpentCost">0 Kč</span>
                                </div>
                                <div class="flex justify-between group relative">
                                    <div class="flex items-center">
                                        <span class="text-gray-600">Ušlý příjem (neobsazenost):</span>
                                        <div class="ml-1 relative group">
                                            <svg class="w-4 h-4 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                            </svg>
                                            <div class="hidden group-hover:block absolute z-10 w-64 p-3 -left-32 -top-20 bg-white shadow-lg rounded-lg text-sm text-gray-600">
                                                Průměrná doba neobsazenosti <strong>2 měsíce</strong> ročně<br><br>
                                                Zahrnuje čas potřebný pro:<br>
                                                • Hledání nového nájemníka<br>
                                                • Úklid a drobné opravy<br>
                                                • Převedení služeb<br>
                                                <em>Založeno na průměrných datech z trhu</em>
                                            </div>
                                        </div>
                                    </div>
                                    <span class="font-semibold" id="vacancyCost">0 Kč</span>
                                </div>
                                <div class="flex justify-between group relative">
                                    <div class="flex items-center">
                                        <span class="text-gray-600">Problémový nájemník:</span>
                                        <div class="ml-1 relative group">
                                            <svg class="w-4 h-4 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                            </svg>
                                            <div class="hidden group-hover:block absolute z-10 w-64 p-3 -left-32 -top-24 bg-white shadow-lg rounded-lg text-sm text-gray-600">
                                                <strong>35% pronajímatelů</strong> se setká s problémovým nájemníkem<br><br>
                                                Průměrné náklady zahrnují:<br>
                                                • Nezaplacený nájem (1-2 měsíce)<br>
                                                • Poškození majetku<br>
                                                • Právní výdaje na vystěhování<br>
                                                • Úklid a opravy po odchodu<br>
                                                <em>Průměrná roční ztráta</em>
                                            </div>
                                        </div>
                                    </div>
                                    <span class="font-semibold" id="problemTenantCost">0 Kč</span>
                                </div>
                                <div class="flex justify-between group relative">
                                    <div class="flex items-center">
                                        <span class="text-gray-600">Právní náklady:</span>
                                        <div class="ml-1 relative group">
                                            <svg class="w-4 h-4 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                            </svg>
                                            <div class="hidden group-hover:block absolute z-10 w-64 p-3 -left-32 -top-24 bg-white shadow-lg rounded-lg text-sm text-gray-600">
                                                Roční náklady na právní servis:<br>
                                                • Příprava smluv (5 000 Kč)<br>
                                                • Právní konzultace (5 000 Kč)<br>
                                                • Soudní poplatky (5 000 Kč)<br><br>
                                                <em>I při běžném provozu jsou právní služby nutností pro řádnou ochranu vašich zájmů.</em>
                                            </div>
                                        </div>
                                    </div>
                                    <span class="font-semibold" id="legalCostDisplay">0 Kč</span>
                                </div>
                                <div class="flex justify-between group relative">
                                    <div class="flex items-center">
                                        <span class="text-gray-600">Opravy a údržba:</span>
                                        <div class="ml-1 relative group">
                                            <svg class="w-4 h-4 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                            </svg>
                                            <div class="hidden group-hover:block absolute z-10 w-64 p-3 -left-32 -top-16 bg-white shadow-lg rounded-lg text-sm text-gray-600">
                                                Průměrné roční náklady na údržbu:<br>
                                                • Pravidelná údržba (5 000 Kč)<br>
                                                • Menší opravy (3 000 Kč)<br><br>
                                                <em>Zahrnuje výměnu žárovek, opravy kohoutků, malování apod. Větší opravy jsou kalkulovány zvlášť.</em>
                                            </div>
                                        </div>
                                    </div>
                                    <span class="font-semibold" id="repairCostDisplay">0 Kč</span>
                                </div>
                            </div>
                        </div>

                        <!-- Vzorný nájemce -->
                        <div class="bg-white rounded-xl p-6 border-2 border-[#0D28F2]">
                            <div class="text-center mb-4">
                                <h4 class="text-lg font-bold text-[#0D28F2] mb-2">Vzorný nájemce</h4>
                                <div class="text-2xl font-bold text-[#0D28F2]" id="professionalTotal">0 Kč</div>
                            </div>
                            
                            <div class="space-y-3 text-sm">
                                <div class="flex justify-between">
                                    <span class="text-gray-600">Služba Vzorný nájemce:</span>
                                    <span class="font-semibold text-[#0D28F2]" id="professionalCommission">0 Kč</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-600">Čas strávený správou:</span>
                                    <span class="font-semibold text-[#0D28F2]">0 Kč</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-600">Ušlý příjem:</span>
                                    <span class="font-semibold text-[#0D28F2]">0 Kč</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-600">Problémový nájemník:</span>
                                    <span class="font-semibold text-[#0D28F2]">0 Kč</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-600">Právní náklady:</span>
                                    <span class="font-semibold text-[#0D28F2]">0 Kč</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Úspora -->
                <div class="bg-gradient-to-r from-[#0D28F2] to-[#0D28F2]/80 rounded-2xl p-6 text-white text-center">
                    <h3 class="text-xl font-bold mb-2">Vaše roční úspora</h3>
                    <div class="text-4xl font-bold mb-2" id="totalSavings">0 Kč</div>
                    <p class="text-blue-100" id="savingsDescription">Ušetříte čas, nervy i peníze</p>
                </div>

                <!-- CTA -->
                <div class="text-center mt-8">
                    <button onclick="Alpine.store('popup').open()" class="inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium rounded-full text-white bg-[#0D28F2] hover:bg-[#0D28F2]/90 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105">
                        Chci ušetřit tyto peníze →
                    </button>
                </div>
            </div>
        `;
    }

    attachEventListeners() {
        const hourlyRateInput = document.getElementById('hourlyRate');
        const monthlyRentInput = document.getElementById('monthlyRent');

        hourlyRateInput.addEventListener('input', (e) => {
            this.data.hourlyRate = parseInt(e.target.value) || 0;
            this.calculate();
        });

        monthlyRentInput.addEventListener('input', (e) => {
            this.data.monthlyRent = parseInt(e.target.value) || 0;
            this.calculate();
        });
    }

    calculate() {
        // Výpočty pro vlastní správu
        const timeSpentCost = this.data.timeSpentSelfManagement * this.data.hourlyRate; // roční náklady na čas
        const vacancyCost = this.data.vacancyMonths * this.data.monthlyRent; // ušlý příjem z neobsazenosti
        const problemTenantCost = this.data.problemTenantCosts; // náklady na problémového nájemníka
        const legalCosts = this.data.legalCosts; // právní náklady
        const repairCosts = this.data.repairCosts; // náklady na opravy

        const selfManagementTotal = timeSpentCost + vacancyCost + problemTenantCost + legalCosts + repairCosts;

        // Výpočty pro Vzorný nájemce
        const annualRent = this.data.monthlyRent * 12;
        const commissionCost = annualRent * 0.12; // 12% provize

        const professionalTotal = commissionCost;

        // Úspora
        const totalSavings = selfManagementTotal - professionalTotal;

        // Aktualizace UI
        this.updateUI({
            timeSpentCost,
            vacancyCost,
            problemTenantCost,
            legalCosts,
            repairCosts,
            selfManagementTotal,
            commissionCost,
            professionalTotal,
            totalSavings
        });
    }

    updateUI(calculations) {
        // Vlastní správa
        document.getElementById('timeSpentCost').textContent = this.formatCurrency(calculations.timeSpentCost);
        document.getElementById('vacancyCost').textContent = this.formatCurrency(calculations.vacancyCost);
        document.getElementById('problemTenantCost').textContent = this.formatCurrency(calculations.problemTenantCost);
        document.getElementById('legalCostDisplay').textContent = this.formatCurrency(calculations.legalCosts);
        document.getElementById('repairCostDisplay').textContent = this.formatCurrency(calculations.repairCosts);
        document.getElementById('selfManagementTotal').textContent = this.formatCurrency(calculations.selfManagementTotal);

        // Vzorný nájemce
        document.getElementById('professionalCommission').textContent = this.formatCurrency(calculations.commissionCost);
        document.getElementById('professionalTotal').textContent = this.formatCurrency(calculations.professionalTotal);

        // Úspora
        document.getElementById('totalSavings').textContent = this.formatCurrency(calculations.totalSavings);
        
        const savingsDescription = calculations.totalSavings > 0 
            ? `To je ${Math.round(calculations.totalSavings / this.data.monthlyRent)} měsíčních nájmů!`
            : 'Profesionální správa se vyplatí dlouhodobě';
        
        document.getElementById('savingsDescription').textContent = savingsDescription;
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('cs-CZ', {
            style: 'currency',
            currency: 'CZK',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(Math.round(amount));
    }
}

// Export pro použití v jiných souborech
window.SavingsCalculator = SavingsCalculator;
