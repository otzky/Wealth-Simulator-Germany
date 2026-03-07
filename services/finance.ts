import { SimulationConfig, SimulationResult, YearlyResult, DurationType } from '../types';

export const calculateAge = (birthDate: string, referenceDateString?: string): number => {
  const birth = new Date(birthDate);
  const ref = referenceDateString ? new Date(referenceDateString) : new Date();
  let age = ref.getFullYear() - birth.getFullYear();
  const m = ref.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

export const runSimulation = (config: SimulationConfig): SimulationResult => {
  const startObj = new Date(config.simulationStartDate);
  const startYear = startObj.getFullYear();
  
  // Calculate age at the start of the simulation
  let currentAge = calculateAge(config.birthDate, config.simulationStartDate);
  
  let totalYears = config.durationYears;
  if (config.durationType === DurationType.TARGET_AGE) {
    totalYears = Math.max(1, config.targetAge - currentAge);
  }

  // Derived Rates
  const monthlyTotalReturnRate = Math.pow(1 + config.annualTotalReturn / 100, 1 / 12) - 1;
  // We approximate monthly dividend yield to distribute payout checks (simplification: uniform distribution)
  // Or typically dividends happen quarterly/annually. For smoother graphs, we'll simulate monthly accrual but track taxation annually.
  // Ideally: Price Return = Total Return - Dividend Yield.
  const annualPriceReturn = config.annualTotalReturn - config.annualDividendYield;
  const monthlyPriceReturnRate = Math.pow(1 + annualPriceReturn / 100, 1 / 12) - 1;
  
  // Tax Rate Calculation
  // KapESt + Soli + KiSt
  const baseTax = config.capitalGainsTax / 100;
  const soli = baseTax * (config.solidaritySurcharge / 100);
  const church = baseTax * (config.churchTax / 100);
  const totalTaxRate = baseTax + soli + church;

  let currentValue = config.initialCapital * (1 - config.entryFee / 100); // Deduct entry fee once on start? Usually only on buy.
  // Re-adjust: Initial capital is invested. Entry fee applies to the transaction.
  // Assuming "Initial Capital" is the amount available to buy shares.
  currentValue = config.initialCapital / (1 + config.entryFee/100); 
  // Actually, usually you pay 10k, fees are taken out. Let's assume standard broker logic: 10k deposit, fee deducted.
  currentValue = config.initialCapital * (1 - config.entryFee/100);

  let totalInvested = config.initialCapital;
  
  const yearlyResults: YearlyResult[] = [];
  
  let accumulatedDividends = 0;
  let accumulatedDividendsReal = 0;
  let accumulatedCosts = config.initialCapital * (config.entryFee/100);
  let accumulatedTaxes = 0;

  // Loop
  for (let year = 1; year <= totalYears; year++) {
    const yearStartValue = currentValue;
    let yearlyDivsGross = 0;
    let yearlyDivsNet = 0;
    let yearlyTaxes = 0;
    let yearlyInvested = 0;

    // Pauschbetrag resets every year
    let remainingAllowance = config.taxAllowance;

    for (let month = 1; month <= 12; month++) {
      const monthIndex = (year - 1) * 12 + month;
      
      // 1. Determine Monthly Savings
      let monthlySavings = config.baseMonthlySavings;
      // Check for step-ups
      const step = config.savingsSteps
        .filter(s => s.yearStart <= year)
        .sort((a, b) => b.yearStart - a.yearStart)[0]; // Get latest applicable
      if (step) {
        monthlySavings = step.monthlyAmount;
      }

      // 2. Check One-Time Investments
      let oneTimeInv = 0;
      const oneTime = config.oneTimeInvestments.find(i => i.year === year && month === 1); // Apply in Jan
      if (oneTime) {
        oneTimeInv = oneTime.amount;
      }

      // 3. Invest Cash (Savings + OneTime)
      const investmentAmount = monthlySavings + oneTimeInv;
      if (investmentAmount > 0) {
        const fee = investmentAmount * (config.entryFee / 100);
        accumulatedCosts += fee;
        const netInvest = investmentAmount - fee;
        currentValue += netInvest;
        totalInvested += investmentAmount;
        yearlyInvested += investmentAmount;
      }

      // 4. Appreciation (Price Gains)
      currentValue = currentValue * (1 + monthlyPriceReturnRate);

      // 5. Dividends
      // Approx: Monthly portion of annual yield applied to current value
      // Note: Dividend Yield is usually based on Start of Year or Average value. 
      // We will use a simplified monthly accrual based on current value to compound correctly if reinvested.
      const monthlyDivYieldFactor = Math.pow(1 + config.annualDividendYield / 100, 1 / 12) - 1;
      const grossDividend = currentValue * monthlyDivYieldFactor;
      yearlyDivsGross += grossDividend;

      // 6. Taxation of Dividend
      let taxableAmount = grossDividend;
      let taxDeduction = 0;

      // Apply Allowance
      if (remainingAllowance > 0) {
        if (remainingAllowance >= taxableAmount) {
          remainingAllowance -= taxableAmount;
          taxableAmount = 0;
        } else {
          taxableAmount -= remainingAllowance;
          remainingAllowance = 0;
        }
      }

      // Apply Tax
      if (taxableAmount > 0) {
        taxDeduction = taxableAmount * totalTaxRate;
      }

      yearlyTaxes += taxDeduction;
      const netDividend = grossDividend - taxDeduction;
      yearlyDivsNet += netDividend;

      // 7. Handling Dividend (Reinvest vs Payout)
      if (config.reinvestDividends) {
        // Reinvest net dividend
        // Assuming no order fees on reinvestment (common in savings plans, but strictly speaking might have fees)
        // We'll treat it as cost-free reinvestment for simplicity or add standard fee
        currentValue += netDividend;
      } else {
        // Payout - does not add to depot value
        // But we track it for total return
      }

      // 8. Costs (TER)
      // TER is usually deducted from fund assets daily/yearly. We approximate monthly.
      const monthlyTerRate = Math.pow(1 + config.yearlyTer / 100, 1 / 12) - 1;
      const costAmount = currentValue * monthlyTerRate;
      currentValue -= costAmount;
      accumulatedCosts += costAmount;
    }

    accumulatedTaxes += yearlyTaxes;
    accumulatedDividends += yearlyDivsNet;

    // Inflation Adjustment (Deflator)
    // Real Value = Nominal / (1 + inflation)^years
    const inflationFactor = Math.pow(1 + config.inflationRate / 100, year);
    const realDivsNet = yearlyDivsNet / inflationFactor;
    
    accumulatedDividendsReal += realDivsNet;

    // Calculate display year. If we start in 2024, year 1 is 2024 (end of).
    // Using startYear + year - 1 aligns the data row with the calendar year being simulated.
    const displayYear = startYear + year - 1;

    yearlyResults.push({
      year: displayYear,
      age: currentAge + year,
      investedCapital: totalInvested,
      nominalValueStart: yearStartValue,
      nominalValueEnd: currentValue,
      nominalDividendsGross: yearlyDivsGross,
      nominalDividendsNet: yearlyDivsNet,
      nominalTaxesPaid: yearlyTaxes,
      realValueEnd: currentValue / inflationFactor,
      realDividendsNet: realDivsNet,
      accumulatedDividends,
      accumulatedCosts
    });
  }

  // Final Summary Calculation
  // Fictitious Liquidation for Net Wealth comparison
  // Gain = CurrentValue - TotalInvested. 
  
  const totalGain = Math.max(0, currentValue - totalInvested);
  // We assume the allowance was used up by dividends in the last year, simplistically.
  const finalLiquidationTax = totalGain * totalTaxRate; 
  const finalValueNetLiquidated = currentValue - finalLiquidationTax;

  const inflationFactorEnd = Math.pow(1 + config.inflationRate / 100, totalYears);

  const result: SimulationResult = {
    yearlyData: yearlyResults,
    finalSummary: {
      totalInvested,
      finalValueNominal: currentValue,
      finalValueReal: currentValue / inflationFactorEnd,
      finalValueNetLiquidated,
      totalDividendsReceived: accumulatedDividends,
      totalDividendsReceivedReal: accumulatedDividendsReal,
      totalTaxesPaid: accumulatedTaxes
    }
  };

  // Back Calculation Logic
  if (config.backCalculation.enabled) {
    const { targetWealth, wealthType, targetMonthlyDividend, dividendType, variableToAdjust } = config.backCalculation;
    
    // Helper to check if targets are met
    const checkTargets = (res: SimulationResult): boolean => {
      let wealthMet = true;
      let divMet = true;

      if (targetWealth && targetWealth > 0) {
        const wealth = wealthType === 'REAL' 
          ? res.finalSummary.finalValueReal 
          : res.finalSummary.finalValueNominal;
        wealthMet = wealth >= targetWealth;
      }

      if (targetMonthlyDividend && targetMonthlyDividend > 0) {
        const lastYear = res.yearlyData[res.yearlyData.length - 1];
        if (!lastYear) return false;
        
        const monthlyDiv = dividendType === 'REAL' 
          ? lastYear.realDividendsNet / 12 
          : lastYear.nominalDividendsNet / 12;
          
        divMet = monthlyDiv >= targetMonthlyDividend;
      }

      return wealthMet && divMet;
    };

    // Binary Search
    let low = 0;
    let high = 0;
    
    if (variableToAdjust === 'RETURN') high = 100; // 100% return
    else if (variableToAdjust === 'SAVINGS_RATE') high = 100000; // 100k savings
    else if (variableToAdjust === 'INITIAL_CAPITAL') high = 5000000; // 5M initial capital

    let bestVal = -1;
    let success = false;

    // Create a temporary config for simulation
    const tempConfig = { ...config, backCalculation: { ...config.backCalculation, enabled: false } };

    for (let i = 0; i < 50; i++) { // 50 iterations for precision
      const mid = (low + high) / 2;
      
      if (variableToAdjust === 'RETURN') {
        tempConfig.annualTotalReturn = mid;
      } else if (variableToAdjust === 'SAVINGS_RATE') {
        tempConfig.baseMonthlySavings = mid;
      } else if (variableToAdjust === 'INITIAL_CAPITAL') {
        tempConfig.initialCapital = mid;
      }

      const res = runSimulation(tempConfig);
      if (checkTargets(res)) {
        bestVal = mid;
        success = true;
        high = mid; // Try to find lower sufficient value
      } else {
        low = mid;
      }
    }

    if (success) {
      result.backCalculationResult = {
        requiredValue: bestVal,
        variable: variableToAdjust,
        success: true
      };
    } else {
       result.backCalculationResult = {
        requiredValue: 0,
        variable: variableToAdjust,
        success: false
      };
    }
  }

  return result;
};