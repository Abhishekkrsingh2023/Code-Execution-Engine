import requests
import json


BASE_URL = "http://localhost:8000"


def create_problem_template(problem):
    """
    Creates problem statement template.
    """
    url = f"{BASE_URL}/problem-templates/"

    response = requests.post(
        url,
        json=problem,
        headers={
            "accept": "application/json",
            "Content-Type": "application/json"
        }
    )

    response.raise_for_status()

    print(f"Problem created: {problem['problem_id']}")
    return response.json()


def create_language_template(problem_id, language, template):
    """
    Creates source code template for a language.
    """

    url = f"{BASE_URL}/problem-templates/{problem_id}/languages/{language}"

    response = requests.post(
        url,
        json=template,
        headers={
            "accept": "application/json",
            "Content-Type": "application/json"
        }
    )

    response.raise_for_status()

    print(f"Added {language} template for {problem_id}")
    return response.json()


def load_templates():
    """
    Returns all language templates.
    """

    return {
    "python": {
      "user_code": "class Solution:\n    def printRightAngledTriangle(self, n: int) -> None:\n        # Write your code here\n        pass",
      "main_code": "import sys\n\n{{ user_code }}\n\ndef main():\n    data = sys.stdin.read().strip()\n    if not data:\n        return\n    n = int(data)\n    solution = Solution()\n    solution.printRightAngledTriangle(n)\n\nif __name__ == \"__main__\":\n    main()"
    },
    "java": {
      "user_code": "class Solution {\n    public void printRightAngledTriangle(int n) {\n        // Write your code here\n    }\n}",
      "main_code": "import java.util.Scanner;\n\n{{ user_code }}\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        int n = scanner.nextInt();\n        scanner.close();\n        \n        Solution solution = new Solution();\n        solution.printRightAngledTriangle(n);\n    }\n}"
    },
    "cpp": {
      "user_code": "class Solution {\npublic:\n    void printRightAngledTriangle(int n) {\n        // Write your code here\n    }\n};",
      "main_code": "#include <iostream>\n\n{{ user_code }}\n\nint main() {\n    int n;\n    std::cin >> n;\n    \n    Solution solution;\n    solution.printRightAngledTriangle(n);\n    \n    return 0;\n}"
    },
    "c": {
      "user_code": "void printRightAngledTriangle(int n) {\n    // Write your code here\n}",
      "main_code": "#include <stdio.h>\n\n{{ user_code }}\n\nint main() {\n    int n;\n    scanf(\"%d\", &n);\n    \n    printRightAngledTriangle(n);\n    \n    return 0;\n}"
    }
  }



def main():
    problem_id = "0006"  # must match the problem_id inside the `problem` dict below
    problem = {
  "problem_id": "0006",
  "problem_statement": "# 1. Right-Angled Triangle of Stars\n**Difficulty:** Easy\n\n## Problem Statement\n\nWrite a program that prints a right-angled triangle composed of asterisk (`*`) characters. The triangle should be aligned to the left and have a height of `n` rows, where `n` is an integer provided as input.\n\nThe first row should contain exactly 1 star, the second row should contain exactly 2 stars, and so on, up to the `n`-th row which contains `n` stars. There should be no trailing spaces on any line.\n\n**Important:** You must print the result to standard output. Do not return any value.\n\n## Examples\n\n**Example 1:**\n\n```\nInput:\n5\n\nOutput:\n*\n**\n***\n****\n*****\n```\n\n**Explanation:**\nFor n = 5, the triangle has 5 rows with 1, 2, 3, 4, and 5 stars respectively.\n\n**Example 2:**\n\n```\nInput:\n3\n\nOutput:\n*\n**\n***\n```\n\n## Constraints\n\n- `1 <= n <= 100`\n- The input will always be a single integer.\n\n## Notes\n\n- Ensure there are no extra spaces at the end of each line.\n- Each line should be printed on a new line.",
  "run_test_cases": [
    {
      "input": "5\n",
      "output": "*\n**\n***\n****\n*****\n"
    },
    {
      "input": "3\n",
      "output": "*\n**\n***\n"
    },
    {
      "input": "1\n",
      "output": "*\n"
    }
  ],
  "submit_test_cases": [
    {
      "input": "10\n",
      "output": "*\n**\n***\n****\n*****\n******\n*******\n********\n*********\n**********\n"
    },
    {
      "input": "7\n",
      "output": "*\n**\n***\n****\n*****\n******\n*******\n"
    },
    {
      "input": "100\n",
      "output": "*\n**\n***\n****\n*****\n******\n*******\n********\n*********\n**********\n***********\n************\n*************\n**************\n***************\n****************\n*****************\n******************\n*******************\n********************\n*********************\n**********************\n***********************\n************************\n*************************\n**************************\n***************************\n****************************\n*****************************\n******************************\n*******************************\n********************************\n*********************************\n**********************************\n***********************************\n************************************\n*************************************\n**************************************\n***************************************\n****************************************\n*****************************************\n******************************************\n*******************************************\n********************************************\n*********************************************\n**********************************************\n***********************************************\n************************************************\n*************************************************\n**************************************************\n***************************************************\n****************************************************\n*****************************************************\n******************************************************\n*******************************************************\n********************************************************\n*********************************************************\n**********************************************************\n***********************************************************\n************************************************************\n*************************************************************\n**************************************************************\n***************************************************************\n****************************************************************\n*****************************************************************\n******************************************************************\n*******************************************************************\n********************************************************************\n*********************************************************************\n**********************************************************************\n***********************************************************************\n************************************************************************\n*************************************************************************\n**************************************************************************\n***************************************************************************\n****************************************************************************\n*****************************************************************************\n******************************************************************************\n*******************************************************************************\n********************************************************************************\n*********************************************************************************\n**********************************************************************************\n***********************************************************************************\n************************************************************************************\n*************************************************************************************\n**************************************************************************************\n***************************************************************************************\n****************************************************************************************\n*****************************************************************************************\n******************************************************************************************\n*******************************************************************************************\n********************************************************************************************\n*********************************************************************************************\n**********************************************************************************************\n***********************************************************************************************\n************************************************************************************************\n*************************************************************************************************\n**************************************************************************************************\n***************************************************************************************************\n****************************************************************************************************\n"
    }
  ],
  "time_limit": 2
}
    # create_problem_template(problem=problem)
    for code, val in load_templates().items():
      create_language_template(problem_id,code, val)
      # print(code,val)
if __name__=="__main__":
    main()