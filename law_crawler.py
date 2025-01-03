import requests
import pandas as pd
import time
from typing import List, Dict

class LawCrawler:
    def __init__(self):
        self.base_url = "https://flk.npc.gov.cn/api/"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }

    def get_page_data(self, page: int) -> List[Dict]:
        """获取单页数据"""
        params = {
            "page": page,
            "type": "",
            "searchType": "title;vague",
            "sortTr": "f_bbrq_s;desc",
            "gbrqStart": "",
            "gbrqEnd": "",
            "sxrqStart": "",
            "sxrqEnd": "",
            "sort": "true",
            "last": "true",
            "size": 10,
            "_": int(time.time() * 1000)
        }

        try:
            response = requests.get(self.base_url, params=params, headers=self.headers)
            response.raise_for_status()
            data = response.json()
            return data["result"]["data"]
        except Exception as e:
            print(f"获取第{page}页数据时出错: {str(e)}")
            return []

    def crawl_all_data(self) -> pd.DataFrame:
        """爬取所有数据并返回DataFrame"""
        all_data = []
        page = 1
        
        while True:
            # 跳过第20页
            if page == 20:
                print('跳过第20页数据...')
                page += 1
                continue
            
            print(f"正在爬取第{page}页...")
            page_data = self.get_page_data(page)
            
            if not page_data:
                break
            
            all_data.extend(page_data)
            time.sleep(1)  # 添加延迟，避免请求过快
            page += 1

        return pd.DataFrame(all_data)

    def save_to_csv(self, df: pd.DataFrame, filename: str = "laws_data.csv"):
        """保存数据到CSV文件"""
        df.to_csv(filename, index=False, encoding='utf-8-sig')
        print(f"数据已保存到 {filename}")

def main():
    crawler = LawCrawler()
    df = crawler.crawl_all_data()
    crawler.save_to_csv(df)
    print(f"共爬取 {len(df)} 条数据")
    print("\n数据预览:")
    print(df.head())

if __name__ == "__main__":
    main() 