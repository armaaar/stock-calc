export interface SettingsDto {
  tick: string;
  exchange?: string;
  isin: string;
  shares: number;
  targetPercentage: number;
}

export interface SecurityPriceDto {
  price: number,
  currency: string
}

export interface IPriceDataDriver {
  getPrice(setting: SettingsDto): Promise<SecurityPriceDto>
}
