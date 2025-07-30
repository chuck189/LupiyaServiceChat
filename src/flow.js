/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// This object is generated from Flow Builder under "..." > Endpoint > Snippets > Responses
// To navigate to a screen, return the corresponding response from the endpoint. Make sure the response is encrypted.
import { LupiyaService } from "./lupiyaep.js";
const SCREEN_RESPONSES = {
  LOAN_FORM: {
    screen: "LOAN_FORM",
    data: {
      employment_status: [
        {
          id: "employed",
          title: "Employed"
        },
        {
          id: "self_employed",
          title: "Self-Employed"
        },
        {
          id: "unemployed",
          title: "Unemployed"
        },
        {
          id: "student",
          title: "Student"
        }
      ]
    }
  },
  UPLOAD: {
    screen: "UPLOAD",
    data: {}
  },
  SUMMARY: {
    screen: "SUMMARY",
    data: {}
  },
  CONFIRMATION: {
    screen: "CONFIRMATION",
    data: {}
  },
  TERMS: {
    screen: "TERMS",
    data: {}
  }
};


export const getNextScreen = async (decryptedBody) => {
  const { screen, data, version, action, flow_token } = decryptedBody;

  // Handle health check request
  if (action === "ping") {
    return {
      data: {
        status: "active"
      }
    };
  }

  // Handle error notification
  if (data?.error) {
    console.warn("Received client error:", data);
    return {
      data: {
        acknowledged: true
      }
    };
  }

  import { LupiyaService } from "./lupiyaep.js";

const SCREEN_RESPONSES = {
  LOAN_FORM: { screen: "LOAN_FORM", data: { /* ... */ } },
  LOAN_STATEMENT_FORM: {
    screen: "LOAN_STATEMENT_FORM",
    data: {
      form: {
        type: "Form",
        name: "loan_statement_form",
        children: [
          {
            type: "TextInput",
            label: "NRC Number",
            name: "nrc_number",
            required: true,
            "helper-text": "Enter your NRC number (e.g., 123456/78/9)"
          },
          {
            type: "Footer",
            label: "Get Statement",
            "on-click-action": {
              name: "data_exchange",
              payload: {
                action: "get_loan_statement",
                nrc_number: "${form.nrc_number}"
              }
            }
          }
        ]
      }
    }
  }
};

export const getNextScreen = async (decryptedBody) => {
  const { screen, data, version, action, flow_token } = decryptedBody;

  if (action === "ping") {
    return { data: { status: "active" } };
  }

  if (data?.error) {
    console.warn("Received client error:", data);
    return { data: { acknowledged: true } };
  }

  if (action === "INIT") {
    return { ...SCREEN_RESPONSES.LOAN_FORM, data: { ...SCREEN_RESPONSES.LOAN_FORM.data } };
  }

  if (action === "data_exchange") {
    switch (screen) {
      case "LOAN_FORM":
        return { ...SCREEN_RESPONSES.UPLOAD, data: { ...data } };
      case "LOAN_STATEMENT_FORM":
        try {
          const result = await LupiyaService.getLoanStatement(data.nrc_number);
          return {
            version: "7.1",
            screen: {
              id: "LOAN_STATEMENT_RESULT",
              title: "Loan Statement",
              terminal: true,
              layout: {
                type: "SingleColumnLayout",
                children: [
                  { type: "TextHeading", text: "Your Loan Statement" },
                  {
                    type: "TextBody",
                    text: result.data && Array.isArray(result.data)
                      ? result.data.map(item =>
                          `Date: ${new Date(item.loanStartDate).toLocaleDateString()}\n` +
                          `Type: ${item.loanType || 'N/A'}\n` +
                          `Amount Paid: ZMW ${Number(item.totalPaymentsMade || 0).toFixed(2)}\n` +
                          `Balance: ZMW ${Number(item.outstandingBalance || 0).toFixed(2)}\n`
                        ).join('\n')
                      : "No loan statement data found."
                  }
                ]
              }
            }
          };
        } catch (error) {
          console.error("Error in LOAN_STATEMENT_FORM:", error.message);
          return {
            version: "7.1",
            screen: {
              id: "ERROR_SCREEN",
              title: "Error",
              terminal: true,
              layout: {
                type: "SingleColumnLayout",
                children: [
                  { type: "TextHeading", text: "Service Error" },
                  { type: "TextBody", text: `Failed to fetch loan statement: ${error.message}` }
                ]
              }
            }
          };
        }
      default:
        break;
    }
  }

  console.error("Unhandled request body:", decryptedBody);
  throw new Error("Unhandled endpoint request.");
};
  // Handle initial request when opening the flow and display LOAN_FORM screen
  if (action === "INIT") {
    return {
      ...SCREEN_RESPONSES.LOAN_FORM,
      data: {
        ...SCREEN_RESPONSES.LOAN_FORM.data
      }
    };
  }

  if (action === "data_exchange") {
    // Handle the request based on the current screen
    switch (screen) {
      // Handles when user interacts with LOAN_FORM screen
      case "LOAN_FORM":
        return {
          ...SCREEN_RESPONSES.UPLOAD,
          data: {
            // Copy data received from Flow
            first_name: data.first_name,
            last_name: data.last_name,
            nrc_number: data.nrc_number,
            dob: data.dob,
            phone: data.phone,
            email: data.email,
            employment_status: data.employment_status,
            loan_amount: data.loan_amount,
            loan_duration: data.loan_duration,
            loan_purpose: data.loan_purpose
          }
        };

      // Handles when user interacts with UPLOAD screen
      case "UPLOAD":
        return {
          ...SCREEN_RESPONSES.SUMMARY,
          data: {
            // Copy data from previous screens and add new data
            ...data,
            documents: data.documents
          }
        };

      // Handles when user interacts with SUMMARY screen
      case "SUMMARY":
        return {
          ...SCREEN_RESPONSES.CONFIRMATION,
          data: {
            // Copy data from previous screens
            ...data
          }
        };

      // Handles when user interacts with CONF confirmation screen
      case "CONFIRMATION":
        return {
          ...SCREEN_RESPONSES.TERMS,
          data: {
            // Copy data from previous screens
            ...data,
            confirmed: data.confirmed || true
          }
        };

      // Handles when user interacts with TERMS screen
      case "TERMS":
        // Send success response to complete and close the flow
        return {
          data: {
            extension_message_response: {
              params: {
                flow_token,
                ...data
              }
            }
          }
        };

      default:
        break;
    }
  }

  console.error("Unhandled request body:", decryptedBody);
  throw new Error(
    "Unhandled endpoint request. Make sure you handle the request action & screen logged above."
  );
};