import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { PublicLayout } from '../components/layout/PublicLayout';
import { HomePage } from '../pages/HomePage';
import { FeaturesOverviewPage } from '../pages/FeaturesOverviewPage';
import { FeaturePage } from '../pages/FeaturePage';
import { PersonaPage } from '../pages/PersonaPage';
import { CountryPage } from '../pages/CountryPage';
import { PricingPage } from '../pages/PricingPage';
import { ContactPage } from '../pages/ContactPage';
import { AboutPage } from '../pages/AboutPage';
import { SecurityPage } from '../pages/SecurityPage';
import { PrivacyPage } from '../pages/legal/PrivacyPage';
import { TermsPage } from '../pages/legal/TermsPage';
import { CookiesPage } from '../pages/legal/CookiesPage';
import { ThanksPage } from '../pages/ThanksPage';
import { NotFoundPage } from '../pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'features',
        element: <FeaturesOverviewPage />,
      },
      {
        path: 'features/:slug',
        element: <FeaturePage />,
      },
      {
        path: 'for/:personaSlug',
        element: <PersonaPage />,
      },
      {
        path: 'construction-software-pakistan',
        element: <CountryPage />,
      },
      {
        path: 'construction-software-us',
        element: <CountryPage />,
      },
      {
        path: 'pricing',
        element: <PricingPage />,
      },
      {
        path: 'contact',
        element: <ContactPage />,
      },
      {
        path: 'about',
        element: <AboutPage />,
      },
      {
        path: 'security',
        element: <SecurityPage />,
      },
      {
        path: 'privacy',
        element: <PrivacyPage />,
      },
      {
        path: 'terms',
        element: <TermsPage />,
      },
      {
        path: 'cookies',
        element: <CookiesPage />,
      },
      {
        path: 'thanks',
        element: <ThanksPage />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);
