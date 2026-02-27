import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";

interface DataPoint {
  month: string;
  cost: number;
  vendor: string;
}

export const VendorCostTrendChart = () => {
  const [vendor1, setVendor1] = useState("");
  const [vendor2, setVendor2] = useState("");
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [trend, setTrend] = useState<{ v1: number; v2: number }>({ v1: 0, v2: 0 });

  const fetchTrend = async () => {
    if (!vendor1 && !vendor2) return;
    setLoading(true);
    try {
      const v1 = vendor1 ? encodeURIComponent(vendor1) : "none";
      const v2 = vendor2 ? encodeURIComponent(vendor2) : "none";
      const res = await fetch(`/api/vendor-trend?v1=${v1}&v2=${v2}`);
      const result = await res.json();
      setData(result.data);
      setTrend(result.trend);
    } catch (error) {
      console.error("Failed to fetch trend data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (vendor1 || vendor2) fetchTrend();
  }, [vendor1, vendor2]);

  return (
    <Card className="w-full" data-testid="card-vendor-trend">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Cost Trend Over Time</span>
          {loading && <Badge variant="secondary">Loading...</Badge>}
        </CardTitle>
        <div className="flex flex-col sm:flex-row gap-3 mt-3">
          <Select onValueChange={setVendor1} value={vendor1}>
            <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-vendor1-trend">
              <SelectValue placeholder="Select Vendor 1" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Vijesh">Vijesh Lighting</SelectItem>
              <SelectItem value="Rehan">Rehan Events</SelectItem>
              <SelectItem value="Golden">Golden Oasis</SelectItem>
              <SelectItem value="Oman">Oman Sound</SelectItem>
            </SelectContent>
          </Select>
          <Select onValueChange={setVendor2} value={vendor2}>
            <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-vendor2-trend">
              <SelectValue placeholder="Select Vendor 2 (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Vijesh">Vijesh Lighting</SelectItem>
              <SelectItem value="Rehan">Rehan Events</SelectItem>
              <SelectItem value="Golden">Golden Oasis</SelectItem>
              <SelectItem value="Oman">Oman Sound</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  formatter={(value) => `${Number(value).toFixed(2)} OMR`}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Legend />
                {vendor1 && (
                  <Line
                    type="monotone"
                    dataKey="cost"
                    stroke="hsl(var(--primary))"
                    name={vendor1}
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))" }}
                  />
                )}
                {vendor2 && data.some((d) => d.vendor === vendor2) && (
                  <Line
                    type="monotone"
                    dataKey="cost"
                    stroke="hsl(var(--destructive))"
                    name={vendor2}
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--destructive))" }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>

            {/* Trend Summary */}
            <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-6 mt-4 text-sm">
              {vendor1 && (
                <div className="flex items-center gap-2" data-testid="trend-vendor1">
                  <Badge variant={trend.v1 >= 0 ? "destructive" : "default"} className="flex items-center gap-1">
                    {trend.v1 >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {Math.abs(trend.v1).toFixed(1)}%
                  </Badge>
                  <span className="text-muted-foreground">{vendor1} vs last month</span>
                </div>
              )}
              {vendor2 && (
                <div className="flex items-center gap-2" data-testid="trend-vendor2">
                  <Badge variant={trend.v2 >= 0 ? "destructive" : "default"} className="flex items-center gap-1">
                    {trend.v2 >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {Math.abs(trend.v2).toFixed(1)}%
                  </Badge>
                  <span className="text-muted-foreground">{vendor2} vs last month</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Select one or two vendors to see cost trends
          </div>
        )}
      </CardContent>
    </Card>
  );
};
