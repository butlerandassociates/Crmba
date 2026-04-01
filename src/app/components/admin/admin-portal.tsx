import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { UserManagement } from "./user-management";
import { ForecastDashboard } from "./forecast-dashboard";
import { ProductManager } from "./product-manager";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Link } from "react-router";
import { FileText, Settings, DollarSign, Package, List } from "lucide-react";

export function AdminPortal() {
  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Admin Portal</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage users, products, and forecasts</p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/admin/estimate-templates">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Estimate Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Create and manage estimate workflows
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/list-management">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <List className="h-5 w-5 text-primary" />
                List Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Manage dropdown lists — categories, lead sources, and more
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Tabs defaultValue="products" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-2xl">
          <TabsTrigger value="products">Products & Pricing</TabsTrigger>
          <TabsTrigger value="forecast">Forecasting</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          <ProductManager />
        </TabsContent>

        <TabsContent value="forecast" className="mt-4">
          <ForecastDashboard />
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <UserManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}