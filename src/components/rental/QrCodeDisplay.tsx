"use client";

import { QRCodeSVG } from "qrcode.react";

const QR_BASE_URL = process.env.NEXT_PUBLIC_QR_BASE_URL ?? "https://rental.donghee.co.kr";

interface QrCodeDisplayProps {
  rentalNo: string;
  size?: number;
}

export default function QrCodeDisplay({ rentalNo, size = 120 }: QrCodeDisplayProps) {
  const url = `${QR_BASE_URL}/rental?no=${rentalNo}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <QRCodeSVG value={url} size={size} level="M" />
      <span className="font-mono text-xs text-gray-600">{rentalNo}</span>
    </div>
  );
}
