import PageTopBar from './PageTopBar';
import SiteFooter from './SiteFooter';
import { useDocumentMeta } from './useDocumentMeta';

export default function PrivacyPolicyPage() {
  useDocumentMeta({
    title: 'Privacy Policy',
    description:
      'Review how EANrunner collects, uses, and protects personal data across its services in line with GDPR, CCPA, and applicable privacy laws.',
    path: '/privacy-policy',
  });

  return (
    <div className="min-h-screen bg-white text-[hsl(222_47%_10%)]">
      <PageTopBar />

      <main className="mx-auto w-full max-w-[860px] px-4 py-10">
        <article className="prose-eanrunner">
          <h1 className="text-4xl font-bold leading-tight text-[hsl(222_47%_10%)]">Privacy Policy</h1>
          <p className="mt-2 text-sm text-[hsl(220_12%_46%)]">Last revised: March 7, 2026</p>

          <p className="mt-6 text-[15px] leading-relaxed text-[hsl(220_14%_30%)]">
            EANrunner (&ldquo;EANrunner,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) operates a
            software platform together with related websites and services (collectively, the &ldquo;Services&rdquo;).
            This Privacy Policy describes how we collect, use, disclose, store, and safeguard personal data when you
            access or use the Services.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-[hsl(220_14%_30%)]">
            We seek to protect personal data and to comply with applicable privacy and data protection laws, including
            the EU General Data Protection Regulation (GDPR), the California Consumer Privacy Act (CCPA), and other
            relevant legal requirements.
          </p>

          <Section title="1. Personal Data We Collect">
            <P>
              <strong>Registration and account information:</strong> This may include your name, email address,
              password, company name, and other contact information submitted when you register for an account.
            </P>
            <P>
              <strong>Payment and billing information:</strong> This includes billing-related details, payment method
              information, and transaction records handled through external payment providers. We do not keep complete
              credit card numbers on our systems.
            </P>
            <P>
              <strong>Service usage information:</strong> We collect information about your interaction with the
              Services, such as the features you use, time spent, device details, IP address, operating system, and
              browser type.
            </P>
            <P>
              <strong>Cookies and similar technologies:</strong> We use cookies, pixels, and related tools to run the
              Services, enhance functionality, analyze performance, and support relevant marketing activities.
              Additional information is available in our Cookie Notice.
            </P>
            <P>
              <strong>Support and communications data:</strong> If you contact our support team, we may collect the
              information you provide, including message content, attachments, and records of communications.
            </P>
          </Section>

          <Section title="2. How We Use Personal Data">
            <P>We use personal data for the following purposes:</P>
            <Bullets
              items={[
                'To deliver, manage, support, and maintain the Services.',
                'To handle subscriptions, billing, refunds, invoices, and related payment administration.',
                'To respond to requests, provide customer assistance, and troubleshoot problems.',
                'To analyze, develop, improve, and optimize the Services, including for analytics, research, and marketing purposes.',
                'To send operational and administrative communications, including messages about your account, service updates, and security matters.',
                'Where permitted by law or based on your consent, to send promotional communications and assess their performance.',
                'To detect, investigate, and prevent fraud, misuse, security threats, and violations of our terms.',
                'To satisfy legal obligations and respond to lawful requests from regulators, courts, or public authorities.',
              ]}
            />
          </Section>

          <Section title="3. GDPR Legal Bases for Processing">
            <P>Where GDPR applies, we rely on one or more of the following legal grounds:</P>
            <P>
              <strong>Performance of a contract:</strong> Where processing is necessary to provide the Services and
              fulfill our contractual obligations to you.
            </P>
            <P>
              <strong>Consent:</strong> Where you have given consent, such as for certain cookie uses or marketing
              communications. You may withdraw consent at any time.
            </P>
            <P>
              <strong>Legitimate interests:</strong> Where processing is necessary for our legitimate business
              interests, including improving the Services, maintaining security, and preventing fraud, provided those
              interests are not overridden by your rights and freedoms.
            </P>
            <P>
              <strong>Legal obligation:</strong> Where processing is required to comply with applicable legal, tax,
              accounting, or regulatory duties.
            </P>
          </Section>

          <Section title="4. How We Share Personal Data">
            <P>
              <strong>Vendors and service providers:</strong> We may share personal data with carefully selected third
              parties that help us operate the Services, such as cloud hosting providers, payment processors, CRM
              providers, analytics vendors, and communication or support platforms. These parties act under contractual
              obligations and may process personal data only on our behalf and under our instructions.
            </P>
            <P>
              <strong>Legal compliance and protection:</strong> We may disclose personal data when required to do so by
              law or when reasonably necessary to protect rights, property, safety, or the integrity of the Services.
            </P>
            <P>
              <strong>Corporate transactions:</strong> If we are involved in a merger, acquisition, financing,
              reorganization, or sale of all or part of our business or assets, personal data may be disclosed or
              transferred as part of that transaction.
            </P>
            <P>We do not sell personal data.</P>
          </Section>

          <Section title="5. International Transfers">
            <P>
              Your personal data may be transferred to, stored in, or processed in countries other than your own. Where
              required by applicable law, we implement appropriate safeguards for such transfers, including the European
              Commission&rsquo;s Standard Contractual Clauses or other lawful transfer mechanisms, and we require
              recipients to provide an adequate level of protection.
            </P>
          </Section>

          <Section title="6. Data Retention">
            <P>
              We keep personal data only for as long as reasonably necessary to provide the Services, pursue legitimate
              business needs, and comply with legal obligations.
            </P>
            <P>
              <strong>Account information:</strong> Retained while your account remains active and deleted within 12
              months after account closure, unless a longer retention period is required by law.
            </P>
            <P>
              <strong>Payment records:</strong> Retained for 5 years for accounting, legal, and compliance purposes.
            </P>
            <P>
              <strong>Usage and analytics data:</strong> Retained for 2 years and then deleted or irreversibly
              anonymized.
            </P>
            <P>
              We may also retain information for as long as needed to resolve disputes, establish or defend legal claims,
              and enforce our agreements.
            </P>
          </Section>

          <Section title="7. Your Privacy Rights">
            <P>
              Depending on where you live, you may have rights to request access to, correction of, updating of,
              deletion of, restriction of, or objection to our processing of your personal data, and you may also have
              the right to data portability.
            </P>
            <P>
              You may unsubscribe from marketing communications at any time by using the unsubscribe option included in
              our messages or by contacting us directly.
            </P>
            <P>
              If you are a California resident, the CCPA may give you the right to request information about the
              categories of personal information collected, the sources of that information, the purposes for collecting
              it, the categories of third parties with whom it is shared, and to request access, deletion, and
              limitation of the use of sensitive personal information where applicable.
            </P>
            <P>
              We will not treat you unfairly or discriminate against you for exercising any privacy rights available to
              you under applicable law.
            </P>
          </Section>

          <Section title="8. Cookies and Similar Technologies">
            <P>
              We use essential, functional, analytics, and advertising cookies. Where the law requires it, we obtain
              your consent before using non-essential cookies. You can manage cookie preferences through your browser
              settings and, where available, through our cookie banner or preference center.
            </P>
          </Section>

          <Section title="9. Security Measures">
            <P>
              We use administrative, technical, and physical safeguards designed to protect personal data. These
              measures include, where appropriate, encryption in transit and at rest, access limitations, role-based
              access controls, audit logs, and periodic security assessments.
            </P>
            <P>
              However, no security measure or method of data transmission or storage can be guaranteed to be completely
              secure. You are responsible for keeping your account credentials confidential.
            </P>
          </Section>

          <Section title="10. Children&rsquo;s Privacy">
            <P>
              The Services are not intended for individuals under the age of 18, and we do not knowingly collect personal
              data from children under 18. If you believe that a child has provided us with personal data, please
              contact us so we can delete it.
            </P>
          </Section>

          <Section title="11. External Services and Third-Party Links">
            <P>
              The Services may contain links to third-party websites or integrations with third-party tools and
              platforms. Those third parties operate under their own privacy policies and practices. We encourage you to
              review their policies before sharing personal data with them.
            </P>
          </Section>

          <Section title="12. Users in Other Countries">
            <P>
              We make the Services available to users in multiple jurisdictions. By using the Services, you understand
              that your personal data may be processed in countries whose privacy laws may differ from those in your
              country of residence. In such cases, we apply the safeguards described in this Privacy Policy where
              required.
            </P>
          </Section>

          <Section title="13. Updates to This Privacy Policy">
            <P>
              We may revise this Privacy Policy from time to time. When we do, we will publish the updated version and
              update the &ldquo;Last revised&rdquo; date shown above. If a change is material, we will provide any
              additional notice required by applicable law.
            </P>
          </Section>

          <Section title="14. Contact Information">
            <P>EANrunner</P>
            <P>
              Email:{' '}
              <a href="mailto:anders@eanrunner.com" className="font-medium text-[hsl(221_92%_42%)] hover:underline">
                anders@eanrunner.com
              </a>
            </P>
            <P>You may also have the right to file a complaint with your local data protection authority.</P>
          </Section>

          <Section title="15. Governing Law and Jurisdiction">
            <P>
              This Privacy Policy, and any dispute arising out of or related to it, is governed by the laws of Denmark,
              without regard to conflict of laws principles. Where mandatory consumer protection laws in your country of
              residence apply, those laws will remain applicable.
            </P>
          </Section>
        </article>

        <SiteFooter className="mt-12" />
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="text-[22px] font-bold leading-tight text-[hsl(222_47%_12%)]">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] leading-relaxed text-[hsl(220_14%_30%)]">{children}</p>;
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-[15px] leading-relaxed text-[hsl(220_14%_30%)]">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="text-[hsl(221_92%_50%)]">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
