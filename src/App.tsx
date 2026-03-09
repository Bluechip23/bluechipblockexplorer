import {
    BrowserRouter as Router,
    Routes,
    Route,
    Navigate
} from 'react-router-dom';
import BlockPage from './pages/individual-pages/BlockPage';
import RecentTransactionsPage from './pages/table-pages/RecentTransactionsPage';
import RecentBlocksPage from './pages/table-pages/RecentBlocksPage';
import TopCreatorContractPage from './pages/table-pages/TopCreatorContractPage';
import TopWalletsPage from './pages/table-pages/TopWalletsPage';
import TopCreatorTokensPage from './pages/table-pages/TopCreatorTokenPage';
import Wallet from './pages/individual-pages/WalletPage';
import CreatorTokenPage from './pages/individual-pages/CreatorTokenPage';
import CreatorContract from './pages/individual-pages/CreatorContractPage';
import FrontPage from './pages/FrontPage';
import Validator from './pages/individual-pages/ValidatorPage';
import TopValidatorsPage from './pages/table-pages/TopValidatorsPage';
import TopCreatorPoolPage from './pages/table-pages/TopCreatorPoolPage';
import RecentBlueChipTransactionPage from './pages/table-pages/RecentBlueChipTransactionsPage';
import TransactionPage from './pages/individual-pages/TransactionPage';
import CreatorPoolPage from './pages/individual-pages/CreatorPoolPage';
import ComingSoonPage from './components/universal/ComingSoonPage';
import NotFoundPage from './pages/NotFoundPage';
import GovernancePage from './pages/GovernancePage';
import StakingPage from './pages/StakingPage';
import IBCTransfersPage from './pages/IBCTransfersPage';
import ContractVerificationPage from './pages/ContractVerificationPage';
import { ThemeContextProvider } from './context/ThemeContext';

function App() {
    return (
        <ThemeContextProvider>
            <Router>
                <Routes>
                    <Route
                        path="/"
                        element={<Navigate replace to="/frontpage" />}
                    />
                    <Route path="/frontpage" element={<FrontPage />} />
                    <Route path="/recenttransactions" element={<RecentTransactionsPage />} />
                    <Route path="/recentblocks" element={<RecentBlocksPage />} />
                    <Route path="/topwallets" element={<TopWalletsPage />} />
                    <Route path="/toptokens" element={<ComingSoonPage/>/*<TopCreatorTokensPage />*/} />
                    <Route path="/topcreatorcontracts" element={<ComingSoonPage/>/*<TopCreatorContractPage />*/} />
                    <Route path="/topvalidators" element={<TopValidatorsPage />} />
                    <Route path="/bluechiptransactions" element={<RecentBlueChipTransactionPage/>} />
                    <Route path="/topcreatorpools" element={<ComingSoonPage/>/*<TopCreatorPoolPage />*/} />
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
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </Router>
        </ThemeContextProvider>
    );
}

export default App;
