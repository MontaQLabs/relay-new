"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface TermsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TermsSheet({ isOpen, onClose }: TermsSheetProps) {
  const lastUpdated = "December 8, 2025";

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-3xl px-0 pb-0 max-h-[70vh] flex flex-col">
        <SheetHeader className="text-left px-6 pb-4 border-b border-gray-100 flex-shrink-0">
          {/* Drag indicator */}
          <div className="flex justify-center pt-2 pb-4">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          <SheetTitle className="text-2xl font-bold tracking-tight text-left text-black">
            Terms of Service
          </SheetTitle>
          <SheetDescription className="text-sm text-gray-500 mt-1">
            Last updated: {lastUpdated}
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-8 text-gray-700 text-sm leading-relaxed pb-8">
            {/* Introduction */}
            <section>
              <h2 className="text-lg font-semibold text-black mb-3">1. Acceptance of Terms</h2>
              <p className="mb-3">
                Welcome to Relay (&quot;Company,&quot; &quot;we,&quot; &quot;our,&quot; or
                &quot;us&quot;). By accessing or using our non-custodial digital wallet application
                and related services (collectively, the &quot;Services&quot;), you agree to be bound
                by these Terms of Service (&quot;Terms&quot;).
              </p>
              <p>If you do not agree to these Terms, you may not access or use our Services.</p>
            </section>

            {/* Description of Services */}
            <section>
              <h2 className="text-lg font-semibold text-black mb-3">2. Description of Services</h2>
              <p className="mb-3">
                Relay provides a non-custodial digital wallet that enables you to:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Generate and manage cryptographic key pairs</li>
                <li>Store, send, and receive digital assets on supported blockchain networks</li>
                <li>Create and participate in community-based activities</li>
                <li>Interact with decentralized applications (dApps)</li>
                <li>View transaction history and account balances</li>
              </ul>
              <p className="mt-3">
                As a non-custodial wallet,{" "}
                <strong>
                  you maintain complete control over your private keys and seed phrase
                </strong>
                . We do not have access to, and cannot recover, your private keys or seed phrase.
              </p>
            </section>

            {/* Wallet Security */}
            <section>
              <h2 className="text-lg font-semibold text-black mb-3">
                3. Wallet Security & Self-Custody
              </h2>
              <p className="mb-3">
                <strong>Your responsibility:</strong> You are solely responsible for maintaining the
                security of your wallet.
              </p>
              <ul className="list-disc pl-5 space-y-2 mb-3">
                <li>
                  <strong>Seed Phrase:</strong> Your 12-word seed phrase is the master key to your
                  wallet. Store it securely offline. Never share it with anyone.
                </li>
                <li>
                  <strong>Password:</strong> Your local password encrypts your wallet on this
                  device. We cannot recover forgotten passwords.
                </li>
                <li>
                  <strong>Device Security:</strong> Keep your device secure with up-to-date
                  software.
                </li>
              </ul>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4">
                <p className="text-amber-800 font-medium">
                  ⚠️ Warning: Loss of your seed phrase means permanent loss of access to your
                  digital assets. We cannot recover your wallet under any circumstances.
                </p>
              </div>
            </section>

            {/* Transactions */}
            <section>
              <h2 className="text-lg font-semibold text-black mb-3">4. Transactions</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  You are responsible for verifying the recipient address and transaction details
                </li>
                <li>Transactions broadcast to blockchain networks are irreversible</li>
                <li>Network fees are determined by the blockchain network, not by us</li>
                <li>Sending assets to an incorrect address may result in permanent loss</li>
              </ul>
            </section>

            {/* Fees */}
            <section>
              <h2 className="text-lg font-semibold text-black mb-3">5. Fees</h2>
              <p>
                Using our wallet is free. However, blockchain networks charge transaction fees (gas
                fees) for processing transactions. These fees are paid directly to network
                validators/miners and are not collected by us.
              </p>
            </section>

            {/* Disclaimers */}
            <section>
              <h2 className="text-lg font-semibold text-black mb-3">6. Disclaimers</h2>
              <p className="mb-3 uppercase text-xs tracking-wide text-gray-500">
                THE SERVICES ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT
                WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED.
              </p>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-lg font-semibold text-black mb-3">7. Contact Us</h2>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="font-medium text-black">Relay Support</p>
                <p className="text-gray-600">support@montaq.org</p>
              </div>
            </section>

            {/* Final acknowledgment */}
            <section className="pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                By using Relay, you acknowledge that you have read, understood, and agree to be
                bound by these Terms of Service.
              </p>
            </section>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
