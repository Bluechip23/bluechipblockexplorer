import { lazy, Suspense } from 'react';
import {
    BrowserRouter as Router,
    Routes,
    Route,
    Navigate
} from 'react-router-dom';
import { ThemeContextProvider } from './context/ThemeContext';
import { WalletContextProvider } from './context/WalletContext';
import { CircularProgress, Box } from '@mui/material';

const BlockPage = lazy(() => import('./pages/individual-pages/BlockPage'));
const RecentTransactionsPage = lazy(() => import('./pages/table-pages/RecentTransactionsPage'));
const RecentBlocksPage = lazy(() => import('./pages/table-pages/RecentBlocksPage'));
const TopCreatorContractPage = lazy(() => import('./pages/table-pages/TopCreatorContractPage'));
const TopWalletsPage = lazy(() => import('./pages/table-pages/TopWalletsPage'));
const TopCreatorTokensPage = lazy(() => import('./pages/table-pages/TopCreatorTokenPage'));
const Wallet = lazy(() => import('./pages/individual-pages/WalletPage'));
const CreatorTokenPage = lazy(() => import('./pages/individual-pages/CreatorTokenPage'));
const CreatorContract = lazy(() => import('./pages/individual-pages/CreatorContractPage'));
const FrontPage = lazy(() => import('./pages/FrontPage'));
const Validator = lazy(() => import('./pages/individual-pages/ValidatorPage'));
const TopValidatorsPage = lazy(() => import('./pages/table-pages/TopValidatorsPage'));
const TopCreatorPoolPage = lazy(() => import('./pages/table-pages/TopCreatorPoolPage'));
const RecentBlueChipTransactionPage = lazy(() => import('./pages/table-pages/RecentBlueChipTransactionsPage'));
const TransactionPage = lazy(() => import('./pages/individual-pages/TransactionPage'));
const CreatorPoolPage = lazy(() => import('./pages/individual-pages/CreatorPoolPage'));
const ComingSoonPage = lazy(() => import('./components/universal/ComingSoonPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const GovernancePage = lazy(() => import('./pages/GovernancePage'));
const StakingPage = lazy(() => import('./pages/StakingPage'));
const IBCTransfersPage = lazy(() => import('./pages/IBCTransfersPage'));
const ContractVerificationPage = lazy(() => import('./pages/ContractVerificationPage'));
const IntegrationGuidePage = lazy(() => import('./pages/IntegrationGuidePage'));
const DefiPage = lazy(() => import('./defi/DefiPage'));
const ChainPortfolioPage = lazy(() => import('./pages/ChainPortfolioPage'));
const CreatorPortfolioPage = lazy(() => import('./pages/CreatorPortfolioPage'));

const PageLoader = () => (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
    </Box>
);

function App() {
    return (
        <ThemeContextProvider>
            <WalletContextProvider>
            <Router>
                <Suspense fallback={<PageLoader />}>
                <Routes>
                    <Route
                        path="/"
                        element={<Navigate replace to="/frontpage" />}
                    />
                    <Route path="/frontpage" element={<FrontPage />} />
                    <Route path="/recenttransactions" element={<RecentTransactionsPage />} />
                    <Route path="/recentblocks" element={<RecentBlocksPage />} />
                    <Route path="/topwallets" element={<TopWalletsPage />} />
                    <Route path="/toptokens" element={<TopCreatorTokensPage />} />
                    <Route path="/topcreatorcontracts" element={<TopCreatorContractPage />} />
                    <Route path="/topvalidators" element={<TopValidatorsPage />} />
                    <Route path="/bluechiptransactions" element={<RecentBlueChipTransactionPage/>} />
                    <Route path="/topcreatorpools" element={<TopCreatorPoolPage />} />
                    <Route path="/transactionpage/:id" element={<TransactionPage />} />
                    <Route path="/creatorpool/:id" element={<CreatorPoolPage />} />
                    <Route path="/comingsoonpage" element={<ComingSoonPage />} />
                    <Route path="/validator/:id" element={<Validator />} />
                    <Route path="/blockpage/:id" element={<BlockPage />} />
                    <Route path="/wallet/:id" element={<Wallet />} />
                    <Route path="/creatortoken/:id" element={<CreatorTokenPage />} />
                    <Route path="/creatorcontract/:id" element={<CreatorContract />} />
                    <Route path="/governance" element={<GovernancePage />} />
                    <Route path="/staking" element={<StakingPage />} />
                    <Route path="/ibc" element={<IBCTransfersPage />} />
                    <Route path="/contract-explorer" element={<ContractVerificationPage />} />
                    <Route path="/integration-guide" element={<IntegrationGuidePage />} />
                    <Route path="/defi" element={<DefiPage />} />
                    <Route path="/portfolio/chain" element={<ChainPortfolioPage />} />
                    <Route path="/portfolio/creator" element={<CreatorPortfolioPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
                </Suspense>
            </Router>
            </WalletContextProvider>
        </ThemeContextProvider>
    );
}

export default App;
