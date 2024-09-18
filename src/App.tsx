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

function App() {
    return (
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
                <Route path="/toptokens" element={<TopCreatorTokensPage />} />
                <Route path="/topcreatorcontracts" element={<TopCreatorContractPage />} />
                <Route path="/topvalidators" element={<TopValidatorsPage />} />
                <Route path="/bluechiptransactions" element={<RecentBlueChipTransactionPage/>} />
                <Route path="/topcreatorpools" element={<TopCreatorPoolPage />} />
                <Route path="/transactionpage/:id" element={<TransactionPage />} />
                <Route path="/creatorpool/:id" element={<CreatorPoolPage />} />
                <Route path="/validator/:id" element={<Validator />} />
                <Route path="/blockpage/:id" element={<BlockPage />} />
                <Route path="/wallet/:id" element={<Wallet />} />
                <Route path="/creatortoken/:id" element={<CreatorTokenPage />} />
                <Route path="/creatorcontract/:id" element={<CreatorContract />} />
            </Routes>
        </Router>
    );
}

export default App;
