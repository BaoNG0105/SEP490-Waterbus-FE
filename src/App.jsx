import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AdminLayout } from "./layout/Admin/AdminLayout";
import { MainLayout } from "./layout/MainLayout";
import { NotFound } from "./pages/NotFound";

import { AdminProtectedRoute } from "./components/AdminProtectedRoute";

//Client
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { BlogList } from "./pages/Blog";
import { BlogDetail } from "./pages/Blog/BlogDetail";
// import { Station } from "./pages/Station";
import { StationDetail } from "./pages/Station/StationDetail";
import { Promotions } from "./pages/Promotions";
import { Contact } from "./pages/Contact";
import { Profile } from "./pages/Profile";
import { EditProfile } from "./pages/Profile/EditProfie";
import { ChangePassword } from "./pages/Profile/ChangePassword";
import { CharterDetail } from "./pages/Profile/MyCharterBooking/MyCharterDetail";
import { EditCharter } from "./pages/Profile/MyCharterBooking/EditCharter";
import { CharterList } from "./pages/Profile/MyCharterBooking";
import { CharterRefund } from "./pages/Profile/MyCharterBooking/CharterRefundRequest";
import { Booking } from "./pages/Booking";
import { CharterBooking } from "./pages/CharterBooking";
import { PaymentResult } from "./pages/PaymentResult";
//Admin
import { Dashboard } from "./pages/Admin/Dashboard";
import { CustomerManagement } from "./pages/Admin/CustomerManagement";
import { BoatManagement, CreateBoat, EditBoat, SeatLayoutEditor } from "./pages/Admin/BoatManagement";
import { StationManagement } from "./pages/Admin/StationManagement";
import { EditStation } from "./pages/Admin/StationManagement/EditStation";
import { Waterway } from "./pages/Admin/RouteManagement/Waterway";
import { AdminCharterBookingDetail, AdminCharterBookingRefund, CharterBookingManagement } from "./pages/Admin/CharterBookingManagement";

function App() {
  return (
    <Router>
      <Routes>
        {/* ============= Client Page ============= */}
        {/* Home Page */}
        <Route
          path="/"
          element={
            <MainLayout>
              <Home />
            </MainLayout>
          }
        />

        {/* Blogs Page */}
        <Route
          path="/blog"
          element={
            <MainLayout>
              <BlogList />
            </MainLayout>
          }
        />

        {/* Blog Detail Page */}
        <Route
          path="/blog/:slug"
          element={
            <MainLayout>
              <BlogDetail />
            </MainLayout>
          }
        />

        {/* Station Detail Page */}
        <Route
          path="/station/:id"
          element={
            <MainLayout>
              <StationDetail />
            </MainLayout>
          }
        />

        {/* Promotions Page */}
        <Route
          path="/promotions"
          element={
            <MainLayout>
              <Promotions />
            </MainLayout>
          }
        />

        {/* Contact Page */}
        <Route
          path="/contact"
          element={
            <MainLayout>
              <Contact />
            </MainLayout>
          }
        />

        {/* Normal Booking Page */}
        <Route
          path="/waterbus-booking"
          element={
            <MainLayout>
              <Booking />
            </MainLayout>
          }
        />

        {/* Charter Booking Page */}
        <Route
          path="/charter-booking"
          element={
            <MainLayout>
              <CharterBooking />
            </MainLayout>
          }
        />

        {/* Profile Page */}
        <Route
          path="/profile"
          element={
            <MainLayout>
              <Profile />
            </MainLayout>
          }
        />

        {/* Edit Profile Page */}
        <Route
          path="/profile/edit"
          element={
            <MainLayout>
              <EditProfile />
            </MainLayout>
          }
        />

        {/* Change Password Page */}
        <Route
          path="/profile/change-password"
          element={
            <ChangePassword />
          }
        />

        {/* My Charter Booking List Page */}
        <Route
          path="/profile/my-charter-booking"
          element={
            <MainLayout>
              <CharterList />
            </MainLayout>
          }
        />

        {/* My Charter Booking Edit Page */}
        <Route
          path="/profile/my-charter-booking/edit/:id"
          element={
            <MainLayout>
              <EditCharter />
            </MainLayout>
          }
        />

        {/* My Charter Booking Refund Page */}
        <Route
          path="/profile/my-charter-booking/:id/refund"
          element={
            <MainLayout>
              <CharterRefund />
            </MainLayout>
          }
        />

        {/* My Charter Booking Detail Page */}
        <Route
          path="/profile/my-charter-booking/:id"
          element={
            <MainLayout>
              <CharterDetail />
            </MainLayout>
          }
        />

        {/* Charter Booking Payment Result Page */}
        <Route
          path="/payment/result"
          element={
            <MainLayout>
              <PaymentResult />
            </MainLayout>
          }
        />
        <Route
          path="/payment/success"
          element={
            <MainLayout>
              <PaymentResult />
            </MainLayout>
          }
        />
        <Route
          path="/payment/cancel"
          element={
            <MainLayout>
              <PaymentResult />
            </MainLayout>
          }
        />

        {/* Login Page */}
        <Route path="/login" element={<Login />} />

        {/* Register Page */}
        <Route path="/register" element={<Register />} />


        {/*============= Admin Page ============= */}
        <Route element={<AdminProtectedRoute />}>
          {/* Admin Dashboard Page */}
          <Route
            path="/admin"
            element={
              <AdminLayout title="Dashboard">
                <Dashboard />
              </AdminLayout>
            }
          />

          {/* ******* Customer Management Page ******* */}
          <Route
            path="/admin/customers-management"
            element={
              <AdminLayout title="Customers Management">
                <CustomerManagement />
              </AdminLayout>
            }
          />

          {/* ******* Boat Management Page ******* */}
          <Route
            path="/admin/boats-management"
            element={
              <AdminLayout title="Boats Management">
                <BoatManagement />
              </AdminLayout>
            }
          />

          {/* Create Boat Page */}
          <Route
            path="/admin/boats-management/create"
            element={
              <AdminLayout title="Create Boat">
                <CreateBoat />
              </AdminLayout>
            }
          />

          {/* Seat Layout Editor Page */}
          <Route
            path="/admin/boats-management/seats/:id"
            element={
              <AdminLayout title="Seat Layout Editor">
                <SeatLayoutEditor />
              </AdminLayout>
            }
          />

          {/* Edit Boat Page */}
          <Route path="/admin/boats-management/edit/:id"
            element={
              <AdminLayout title="Edit Boat">
                <EditBoat />
              </AdminLayout>
            }
          />

          {/* ******* Station Managment Page ******* */}
          <Route
            path="/admin/stations-management"
            element={
              <AdminLayout title="Stations Management">
                <StationManagement />
              </AdminLayout>
            }
          />

          {/* Edit Station Page */}
          <Route
            path="/admin/stations-management/edit/:id"
            element={
              <AdminLayout title="Edit Station">
                <EditStation />
              </AdminLayout>
            }
          />

          {/* ******* Charter Booking Management: List Page ******* */}
          <Route
            path="/admin/charter-bookings-management"
            element={
              <AdminLayout title="Charter Booking Management">
                <CharterBookingManagement />
              </AdminLayout>
            }
          />

          {/* Charter Booking Managment: Detail Page */}
          <Route
            path="/admin/charter-bookings-management/:id"
            element={
              <AdminLayout title="Charter Booking Detail">
                <AdminCharterBookingDetail />
              </AdminLayout>
            }
          />

          {/* Charter Booking Management: Refund Page */}
          <Route
            path="/admin/charter-bookings-management/:id/payments/:paymentId/refund"
            element={
              <AdminLayout title="Refund Payment">
                <AdminCharterBookingRefund />
              </AdminLayout>
            }
          />

          {/* Waterways Page : Để test */}
          <Route
            path="/admin/waterways-management"
            element={
              <AdminLayout title="Waterways Management">
                <Waterway />
              </AdminLayout>
            }
          />
        </Route>

        {/* TRANG BÁO LỖI 404 */}
        <Route path="*" element={<NotFound />} />

      </Routes>
    </Router>
  );
}

export default App;
