export interface SettingsSecurityDto {
  tick: string;
  exchange: string;
  isin?: string;
  shares: number;
  targetPercentage: number;
}

export interface SettingsDto {
  brokerageFeeFlat: number
  tradingFeePercentage: number
  minimumTradingFeeFlat: number
  securities: SettingsSecurityDto[]
}

export interface SecurityPriceDto {
  price: number,
  currency: string
}

export interface IPriceDataDriver {
  getPrice(setting: SettingsSecurityDto): Promise<SecurityPriceDto>
}
