declare module 'flutterwave-react-v3' {
  export interface FlutterwaveConfig {
    public_key: string;
    tx_ref: string;
    amount: number;
    currency: string;
    payment_options?: string;
    customer: {
      email: string;
      name: string;
      phone_number?: string;
    };
    customizations?: {
      title?: string;
      description?: string;
      logo?: string;
    };
    meta?: Record<string, unknown>;
  }

  export interface FlutterwaveResponse {
    transaction_id: number;
    tx_ref: string;
    flw_ref: string;
    amount: number;
    currency: string;
    status: string;
    payment_type: string;
    customer: {
      email: string;
      name: string;
    };
  }

  export type InitializePaymentFn = (options: {
    callback: (response: FlutterwaveResponse) => void;
    onClose: () => void;
  }) => void;

  export function useFlutterwave(config: FlutterwaveConfig): InitializePaymentFn;
  export function closePaymentModal(): void;
}
