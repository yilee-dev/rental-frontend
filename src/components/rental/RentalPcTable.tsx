import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RentalPc } from "@/types";

const RENTAL_TYPE_LABEL: Record<string, string> = {
  NOTEBOOK: "노트북",
  DESKTOP: "데스크탑",
};
const RENTAL_SPEC_LABEL: Record<string, string> = {
  NORMAL: "일반",
  HIGH: "설계",
};

function isExpiringSoon(endDate: string): boolean {
  const diff = new Date(endDate).getTime() - Date.now();
  return diff > 0 && diff <= 30 * 24 * 60 * 60 * 1000;
}

export default function RentalPcTable({ items }: { items: RentalPc[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>렌탈번호</TableHead>
          <TableHead>타입</TableHead>
          <TableHead>사양</TableHead>
          <TableHead>렌탈 게시일</TableHead>
          <TableHead>렌탈 만료일</TableHead>
          <TableHead className="text-right">월 렌탈료</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((pc) => (
          <TableRow key={pc.id}>
            <TableCell className="font-mono">{pc.rentalNo}</TableCell>
            <TableCell>
              <Badge variant={pc.rentalType === "NOTEBOOK" ? "default" : "secondary"}>
                {RENTAL_TYPE_LABEL[pc.rentalType]}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant={pc.rentalSpec === "HIGH" ? "default" : "outline"}>
                {RENTAL_SPEC_LABEL[pc.rentalSpec]}
              </Badge>
            </TableCell>
            <TableCell>{pc.rentalStartDate}</TableCell>
            <TableCell>
              <span className={isExpiringSoon(pc.rentalEndDate) ? "font-semibold text-red-500" : ""}>
                {pc.rentalEndDate}
              </span>
            </TableCell>
            <TableCell className="text-right">
              {pc.monthlyFee.toLocaleString()}원
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
