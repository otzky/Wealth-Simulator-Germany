import type { SimulationConfig } from '../types.js';

export type StateCode = 'BW' | 'BY' | 'BE' | 'BB' | 'HB' | 'HH' | 'HE' | 'MV' | 'NI' | 'NW' | 'RP' | 'SL' | 'SN' | 'ST' | 'SH' | 'TH';

/** What the tenant does with money left over: the same fund settings as the wealth module. */
export type InvestSettings = Pick<SimulationConfig, 'totalReturn' | 'dividendYield' | 'ter' | 'purchaseFee' | 'fundType' | 'churchTax' | 'allowance'>;

export interface BuyRentConfig {
  startYear: number; // year of the purchase; the comparison runs in whole years from January
  years: number; // how long the comparison runs

  // Property
  price: number;
  appreciation: number; // % p.a., nominal, after the building ages

  // Purchase costs
  state: StateCode; // sets the real estate transfer tax
  notary: number; // % of the price, notary and land register
  broker: number; // % of the price, buyer's share incl. VAT

  // Financing
  equity: number; // goes into the tenant's depot instead
  interest: number; // % p.a., fixed rate
  repayment: number; // % p.a. of the loan in the first year
  fixedYears: number; // years the rate is fixed
  followUpRate: number | null; // % p.a. after the fixed period; null = same as `interest`

  // Running costs of the owner
  maintenance: number; // % of the price per year, rises with inflation

  // Renting
  rent: number; // cold rent per month for a comparable home
  rentIncrease: number; // % p.a.

  // General
  sellCost: number; // % of the property's value deducted at the end (as if sold)
  inflation: number; // % p.a.

  invest: InvestSettings;
}

export interface BuyRentYear {
  index: number; // 1 = first year
  year: number; // calendar year
  buyerWealth: number; // property after selling costs − debt + depot after tax
  renterWealth: number; // depot after tax
  propertyValue: number;
  debt: number;
  buyerDepot: number; // after tax
  renterDepot: number; // after tax
  interest: number; // paid during the year
  principal: number;
  maintenance: number;
  rent: number;
  buyerInvested: number; // deposited during the year
  renterInvested: number;
  deflator: number; // cumulative inflation at the end of the year
}

export interface BuyRentResult {
  years: BuyRentYear[];
  purchase: { transferTaxRate: number; transferTax: number; notary: number; broker: number; total: number };
  loan: number; // amount borrowed
  monthlyPayment: number; // first payment (interest + repayment)
  buyerStartDepot: number; // equity left after price and costs, invested by the buyer
  breakEven: number | null; // first year index from which the buyer stays ahead; null = never within the period
  paidOffYear: number | null; // year index in which the loan is repaid
  priceToRent: number; // price / annual cold rent
  totals: {
    interest: number;
    principal: number;
    maintenance: number;
    rent: number;
    buyerInvested: number;
    renterInvested: number;
    buyerTaxes: number;
    renterTaxes: number;
    sellCosts: number;
  };
  warnings: string[];
}

export type TippingKey = 'appreciation' | 'followUpRate' | 'interest' | 'rent' | 'rentIncrease' | 'totalReturn' | 'maintenance' | 'price';

export interface TippingPoint {
  key: TippingKey;
  label: string;
  unit: '%' | '€';
  current: number;
  threshold: number | null; // value at which both ways end equal; null = no switch within the range
  buyingAboveThreshold: boolean; // true: buying wins when the value is above the threshold
  buyingWinsNow: boolean;
}
