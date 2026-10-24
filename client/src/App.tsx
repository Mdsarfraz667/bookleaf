import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { MyBooks } from "./pages/MyBooks";
import { SubmitQuery } from "./pages/SubmitQuery";
import { MyTickets } from "./pages/MyTickets";
import { TicketDetail } from "./pages/TicketDetail";
import { AdminQueue } from "./pages/AdminQueue";
import { AdminTicketDetail } from "./pages/AdminTicketDetail";
import { HomeRedirect, PublicOnly, RequireAuth, RequireRole } from "./routes/guards";

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route element={<PublicOnly />}>
        <Route path="/login" element={<Login />} />
      </Route>

      {/* Authenticated shell */}
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route path="/" element={<HomeRedirect />} />

          {/* Author-only */}
          <Route element={<RequireRole role="AUTHOR" />}>
            <Route path="/books" element={<MyBooks />} />
            <Route path="/submit" element={<SubmitQuery />} />
            <Route path="/tickets" element={<MyTickets />} />
            <Route path="/tickets/:id" element={<TicketDetail />} />
          </Route>

          {/* Admin-only */}
          <Route element={<RequireRole role="ADMIN" />}>
            <Route path="/admin" element={<AdminQueue />} />
            <Route path="/admin/tickets/:id" element={<AdminTicketDetail />} />
          </Route>
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
