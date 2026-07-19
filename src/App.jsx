import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AdminLayout } from "./layout/Admin/AdminLayout";
import { MainLayout } from "./layout/MainLayout";
import { NotFound } from "./pages/NotFound";

import { AdminProtectedRoute } from "./components/AdminProtectedRoute";
import { CustomerOnlyRoute } from "./components/CustomerOnlyRoute";

//Client
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { ForgotPassword } from "./pages/ForgotPassword";
import { BlogList } from "./pages/Blog";
import { BlogDetail } from "./pages/Blog/BlogDetail";
// import { Station } from "./pages/Station";
import { StationDetail } from "./pages/Station/StationDetail";
import { Promotions } from "./pages/Promotions";
import { PromotionDetail } from "./pages/Promotions/PromotionDetail";
import { Contact } from "./pages/Contact";
import { Profile } from "./pages/Profile";
import { EditProfile } from "./pages/Profile/EditProfie";
import { ChangePassword } from "./pages/Profile/ChangePassword";
import { CharterDetail } from "./pages/Profile/MyCharterBooking/MyCharterDetail";
import { EditCharter } from "./pages/Profile/MyCharterBooking/EditCharter";
import { CharterList } from "./pages/Profile/MyCharterBooking";
import { CharterRefund } from "./pages/Profile/MyCharterBooking/CharterRefundRequest";
import { MyWaterbusBookingList } from "./pages/Profile/MyWaterbusBooking";
import { MyWaterbusBookingDetail } from "./pages/Profile/MyWaterbusBooking/MyWaterbusBookingDetail";
import { MySightseeingBookingList } from "./pages/Profile/MySightseeingBooking";
import { MySightseeingBookingDetail } from "./pages/Profile/MySightseeingBooking/MySightseeingBookingDetail";
import { SightseeingRefundRequest } from "./pages/Profile/MySightseeingBooking/SightseeingRefundRequest";
import { WaterbusBooking } from "./pages/WaterbusBooking";
import { WatersightseeingBooking } from "./pages/WatersightseeingBooking";
import { CharterBooking } from "./pages/CharterBooking";
import { PaymentResult } from "./pages/PaymentResult";
//Admin
import { Dashboard } from "./pages/Admin/Dashboard";
import { BoatManagement, CreateBoat, EditBoat, SeatLayoutEditor, BoatCrewSchedule } from "./pages/Admin/BoatManagement";
import { TripManagement, CreateTrip } from "./pages/Admin/TripManagement";
import { StationManagement } from "./pages/Admin/StationManagement";
import { InsuranceManagement } from "./pages/Admin/InsuranceManagement";
import { EditStation } from "./pages/Admin/StationManagement/EditStation";
import { UserManagement } from "./pages/Admin/UserManagement";
import { ManagerManagement } from "./pages/Admin/ManagerManagement";
import { CreateManager } from "./pages/Admin/ManagerManagement/CreateManager";
import { EditManager } from "./pages/Admin/ManagerManagement/EditManager";
import { StaffManagement } from "./pages/Admin/StaffManagement";
import { CreateStaff } from "./pages/Admin/StaffManagement/CreateStaff";
import { EditStaff } from "./pages/Admin/StaffManagement/EditStaff";
import { Waterway } from "./pages/Admin/RouteManagement/Waterway";
import { RouteManagement } from "./pages/Admin/RouteManagement";
import { RouteDetail } from "./pages/Admin/RouteManagement/RouteDetail";
import { MergeGpsRoutes } from "./pages/Admin/RouteManagement/MergeGpsRoutes";
import { LiveOps } from "./pages/Admin/LiveOps";
import { AdminCharterBookingDetail, AdminCharterBookingRefund, CharterBookingManagement } from "./pages/Admin/CharterBookingManagement";
import { PromotionManagement } from "./pages/Admin/PromotionManagement";
import { CreatePromotion } from "./pages/Admin/PromotionManagement/CreatePromotion";
import { EditPromotion } from "./pages/Admin/PromotionManagement/EditPromotion";
import { ViewPromotion } from "./pages/Admin/PromotionManagement/ViewPromotion";
import { StaffAssignmentManagement } from "./pages/Admin/StaffAssignmentManagement";
import { StaffTicketScanPage } from "./pages/Admin/StaffTicketScan";
import { StaffMyTripsPage } from "./pages/Admin/StaffMyTrips";
import { StaffScanHistoryPage } from "./pages/Admin/StaffScanHistory";
import { BlogManagement } from "./pages/Admin/BlogManagement";
import { CreateBlog } from "./pages/Admin/BlogManagement/CreateBlog";
import { EditBlog } from "./pages/Admin/BlogManagement/EditBlog";

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

        {/* Promotion Detail Page */}
        <Route
          path="/promotions/:code"
          element={
            <MainLayout>
              <PromotionDetail />
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

        {/* Các trang đặt vé: chỉ dành cho Khách hàng, chặn Admin/Staff/Manager */}
        <Route element={<CustomerOnlyRoute />}>
          {/* Waterbus Booking Page */}
          <Route
            path="/waterbus-booking"
            element={
              <MainLayout>
                <WaterbusBooking />
              </MainLayout>
            }
          />

          {/* Watersightseeing Booking Page */}
          <Route
            path="/watersightseeing-booking"
            element={
              <MainLayout>
                <WatersightseeingBooking />
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
        </Route>

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

        {/* My Waterbus Booking List Page */}
        <Route
          path="/profile/my-waterbus-booking"
          element={
            <MainLayout>
              <MyWaterbusBookingList />
            </MainLayout>
          }
        />

        {/* My Waterbus Booking Detail Page */}
        <Route
          path="/profile/my-waterbus-booking/:id"
          element={
            <MainLayout>
              <MyWaterbusBookingDetail />
            </MainLayout>
          }
        />

        {/* My Sightseeing Booking List Page */}
        <Route
          path="/profile/my-sightseeing-booking"
          element={
            <MainLayout>
              <MySightseeingBookingList />
            </MainLayout>
          }
        />

        {/* My Sightseeing Booking Refund Page */}
        <Route
          path="/profile/my-sightseeing-booking/:id/refund"
          element={
            <MainLayout>
              <SightseeingRefundRequest />
            </MainLayout>
          }
        />

        {/* My Sightseeing Booking Detail Page */}
        <Route
          path="/profile/my-sightseeing-booking/:id"
          element={
            <MainLayout>
              <MySightseeingBookingDetail />
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

        {/* Forgot Password Page */}
        <Route path="/forgot-password" element={<ForgotPassword />} />


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
            path="/admin/users-management"
            element={
              <AdminLayout title="Customer Management">
                <UserManagement />
              </AdminLayout>
            }
          />

          {/* ******* Manager Management Page ******* */}
          <Route
            path="/admin/managers-management"
            element={
              <AdminLayout title="Manager Management">
                <ManagerManagement />
              </AdminLayout>
            }
          />

          {/* Create Manager Page */}
          <Route
            path="/admin/managers-management/create"
            element={
              <AdminLayout title="Create Manager">
                <CreateManager />
              </AdminLayout>
            }
          />

          {/* Edit Manager Page */}
          <Route
            path="/admin/managers-management/edit/:id"
            element={
              <AdminLayout title="Edit Manager">
                <EditManager />
              </AdminLayout>
            }
          />

          {/* ******* Staff Management Page ******* */}
          <Route
            path="/admin/staffs-management"
            element={
              <AdminLayout title="Staff Management">
                <StaffManagement />
              </AdminLayout>
            }
          />

          {/* Create Staff Page */}
          <Route
            path="/admin/staffs-management/create"
            element={
              <AdminLayout title="Create Staff">
                <CreateStaff />
              </AdminLayout>
            }
          />

          {/* Edit Staff Page */}
          <Route
            path="/admin/staffs-management/edit/:id"
            element={
              <AdminLayout title="Edit Staff">
                <EditStaff />
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

          <Route
            path="/admin/live-tracking"
            element={
              <AdminLayout title="Live Tracking">
                <LiveOps />
              </AdminLayout>
            }
          />

          <Route
            path="/admin/incidents"
            element={<Navigate to="/admin/live-tracking?view=incidents" replace />}
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

          {/* Boat Crew Schedule Page */}
          <Route path="/admin/boats-management/crew/:id"
            element={
              <AdminLayout title="Onboard Staff">
                <BoatCrewSchedule />
              </AdminLayout>
            }
          />

          {/* ******* Trip Management Page ******* */}
          <Route
            path="/admin/trips-management"
            element={
              <AdminLayout title="Trip Management">
                <TripManagement />
              </AdminLayout>
            }
          />

          {/* Create Trip Page */}
          <Route
            path="/admin/trips-management/create"
            element={
              <AdminLayout title="Create Trip">
                <CreateTrip />
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

          {/* ******* Insurance Packages Management ******* */}
          <Route
            path="/admin/insurance-management"
            element={
              <AdminLayout title="Insurance Packages">
                <InsuranceManagement />
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

          {/* ******* Route Management: List Page ******* */}
          <Route
            path="/admin/routes-management"
            element={
              <AdminLayout title="Route Management">
                <RouteManagement />
              </AdminLayout>
            }
          />

          <Route
            path="/admin/routes-management/merge-gps"
            element={
              <AdminLayout title="Merge GPS Routes">
                <MergeGpsRoutes />
              </AdminLayout>
            }
          />

          {/* Route Management: Detail Page */}
          <Route
            path="/admin/routes-management/:id"
            element={
              <AdminLayout title="Route Detail">
                <RouteDetail />
              </AdminLayout>
            }
          />

          {/* ******* Promotion Management: List Page ******* */}
          <Route
            path="/admin/promotions"
            element={
              <AdminLayout title="Promotion Management">
                <PromotionManagement />
              </AdminLayout>
            }
          />

          {/* Promotion Management: Create Page */}
          <Route
            path="/admin/promotions/create"
            element={
              <AdminLayout title="Create Promotion">
                <CreatePromotion />
              </AdminLayout>
            }
          />

          {/* Promotion Management: View Page */}
          <Route
            path="/admin/promotions/view/:id"
            element={
              <AdminLayout title="View Promotion">
                <ViewPromotion />
              </AdminLayout>
            }
          />

          {/* Promotion Management: Edit Page */}
          <Route
            path="/admin/promotions/edit/:id"
            element={
              <AdminLayout title="Edit Promotion">
                <EditPromotion />
              </AdminLayout>
            }
          />

          {/* ******* Staff Assignment Management ******* */}
          <Route
            path="/admin/staff-assignments"
            element={
              <AdminLayout title="Staff Assignments">
                <StaffAssignmentManagement />
              </AdminLayout>
            }
          />

          <Route
            path="/admin/staff/ticket-scan"
            element={
              <AdminLayout title="Ticket Scan">
                <StaffTicketScanPage />
              </AdminLayout>
            }
          />

          <Route
            path="/admin/staff/my-trips"
            element={
              <AdminLayout title="My Trips">
                <StaffMyTripsPage />
              </AdminLayout>
            }
          />

          <Route
            path="/admin/staff/scan-history"
            element={
              <AdminLayout title="Scan History">
                <StaffScanHistoryPage />
              </AdminLayout>
            }
          />

          {/* ******* Blog Management: List Page ******* */}
          <Route
            path="/admin/news"
            element={
              <AdminLayout title="Blog Management">
                <BlogManagement />
              </AdminLayout>
            }
          />

          {/* Blog Management: Create Page */}
          <Route
            path="/admin/news/create"
            element={
              <AdminLayout title="Create Blog Post">
                <CreateBlog />
              </AdminLayout>
            }
          />

          {/* Blog Management: Edit Page */}
          <Route
            path="/admin/news/edit/:id"
            element={
              <AdminLayout title="Edit Blog Post">
                <EditBlog />
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
